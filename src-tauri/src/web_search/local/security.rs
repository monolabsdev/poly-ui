use super::types::WebSearchError;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, ToSocketAddrs};
use url::Url;

pub fn validate_public_http_url(raw: &str) -> Result<Url, WebSearchError> {
    let url = crate::web_search::local::normalize::normalize_url(raw)?;
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err(WebSearchError::InvalidUrl),
    }
    let host = url.host_str().ok_or(WebSearchError::InvalidUrl)?;
    let lower = host.to_ascii_lowercase();
    if lower == "localhost" || lower.ends_with(".local") {
        return Err(WebSearchError::BlockedAddress);
    }
    if let Ok(ip) = host.parse::<IpAddr>() {
        if blocked_ip(ip) {
            return Err(WebSearchError::BlockedAddress);
        }
        return Ok(url);
    }
    let port = url.port_or_known_default().unwrap_or(443);
    let addrs = (host, port)
        .to_socket_addrs()
        .map_err(|_| WebSearchError::InvalidUrl)?;
    for addr in addrs {
        if blocked_ip(addr.ip()) {
            return Err(WebSearchError::BlockedAddress);
        }
    }
    Ok(url)
}

fn blocked_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => blocked_v4(v4),
        IpAddr::V6(v6) => blocked_v6(v6),
    }
}

fn blocked_v4(ip: Ipv4Addr) -> bool {
    ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_multicast()
        || ip.is_unspecified()
        || ip.octets() == [169, 254, 169, 254]
        || ip.octets()[0] == 0
}

fn blocked_v6(ip: Ipv6Addr) -> bool {
    ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        || (ip.segments()[0] & 0xffc0) == 0xfe80
        || (ip.segments()[0] & 0xfe00) == 0xfc00
}
