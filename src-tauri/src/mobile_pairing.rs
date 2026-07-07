use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, UdpSocket};
use std::sync::Arc;
use tauri::State;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{oneshot, Mutex};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MobilePairingInfo {
    pub url: String,
    pub http_base_url: String,
    pub host: String,
    pub port: u16,
    pub token: String,
}

pub struct MobilePairingState {
    current: Mutex<Option<MobilePairingSession>>,
}

struct MobilePairingSession {
    info: MobilePairingInfo,
    stop: oneshot::Sender<()>,
}

impl Default for MobilePairingState {
    fn default() -> Self {
        Self {
            current: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub async fn mobile_pairing_start(
    state: State<'_, MobilePairingState>,
) -> Result<MobilePairingInfo, String> {
    let mut current = state.current.lock().await;
    if let Some(session) = current.as_ref() {
        return Ok(session.info.clone());
    }

    let host = lan_ip().unwrap_or(Ipv4Addr::LOCALHOST).to_string();
    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, 0))
        .await
        .map_err(|error| format!("Failed to start mobile pairing: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Failed to read pairing port: {error}"))?
        .port();
    let token = Uuid::new_v4().to_string();
    let info = build_pairing_info(&host, port, &token);
    let (stop_tx, stop_rx) = oneshot::channel();

    tokio::spawn(run_pairing_server(listener, token, stop_rx));
    *current = Some(MobilePairingSession {
        info: info.clone(),
        stop: stop_tx,
    });

    Ok(info)
}

#[tauri::command]
pub async fn mobile_pairing_stop(state: State<'_, MobilePairingState>) -> Result<(), String> {
    let mut current = state.current.lock().await;
    if let Some(session) = current.take() {
        let _ = session.stop.send(());
    }
    Ok(())
}

#[tauri::command]
pub async fn mobile_pairing_status(
    state: State<'_, MobilePairingState>,
) -> Result<Option<MobilePairingInfo>, String> {
    Ok(state.current.lock().await.as_ref().map(|session| session.info.clone()))
}

fn build_pairing_info(host: &str, port: u16, token: &str) -> MobilePairingInfo {
    let http_base_url = format!("http://{host}:{port}");
    let encoded_base = percent_encoding::utf8_percent_encode(
        &http_base_url,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let url = format!("polyui://pair?base={encoded_base}&token={token}");
    MobilePairingInfo {
        url,
        http_base_url,
        host: host.to_string(),
        port,
        token: token.to_string(),
    }
}

fn lan_ip() -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind((Ipv4Addr::UNSPECIFIED, 0)).ok()?;
    socket.connect((Ipv4Addr::new(8, 8, 8, 8), 80)).ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(ip) if !ip.is_loopback() => Some(ip),
        _ => None,
    }
}

async fn run_pairing_server(
    listener: TcpListener,
    token: String,
    mut stop: oneshot::Receiver<()>,
) {
    let token = Arc::new(token);
    loop {
        tokio::select! {
            _ = &mut stop => break,
            accepted = listener.accept() => {
                let Ok((stream, _addr)) = accepted else { continue };
                let token = Arc::clone(&token);
                tokio::spawn(async move {
                    let _ = handle_connection(stream, token.as_str()).await;
                });
            }
        }
    }
}

async fn handle_connection(mut stream: TcpStream, token: &str) -> std::io::Result<()> {
    let mut buffer = [0_u8; 2048];
    let read = stream.read(&mut buffer).await?;
    let request = String::from_utf8_lossy(&buffer[..read]);
    let path = request
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/");
    let response = response_for_path(path, token);
    stream.write_all(response.as_bytes()).await
}

fn response_for_path(path: &str, token: &str) -> String {
    if path == "/health" {
        return http_response(200, r#"{"ok":true,"app":"PolyUI"}"#);
    }

    let expected = format!("/pair/verify?token={token}");
    if path == expected {
        return http_response(200, r#"{"ok":true,"app":"PolyUI"}"#);
    }

    http_response(401, r#"{"ok":false}"#)
}

fn http_response(status: u16, body: &str) -> String {
    let reason = match status {
        200 => "OK",
        401 => "Unauthorized",
        _ => "Error",
    };
    format!(
        "HTTP/1.1 {status} {reason}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
        body.len()
    )
}

#[cfg(test)]
mod tests {
    use super::{build_pairing_info, response_for_path};

    #[test]
    fn pairing_url_contains_encoded_base_and_token() {
        let info = build_pairing_info("192.168.1.20", 3456, "abc");

        assert_eq!(info.http_base_url, "http://192.168.1.20:3456");
        assert_eq!(
            info.url,
            "polyui://pair?base=http%3A%2F%2F192%2E168%2E1%2E20%3A3456&token=abc"
        );
    }

    #[test]
    fn verify_accepts_matching_token() {
        let response = response_for_path("/pair/verify?token=abc", "abc");

        assert!(response.starts_with("HTTP/1.1 200 OK"));
        assert!(response.contains(r#""ok":true"#));
    }

    #[test]
    fn verify_rejects_wrong_token() {
        let response = response_for_path("/pair/verify?token=nope", "abc");

        assert!(response.starts_with("HTTP/1.1 401 Unauthorized"));
    }
}
