type CardLayoutProps = {
  backgroundImage?: string | null;
  header: React.ReactNode;
  children: React.ReactNode;
};

export function CardLayout({ backgroundImage, header, children }: CardLayoutProps) {
  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden ${backgroundImage ? "" : "bg-sidebar"}`}
    >
      <div
        className="mr-1 mt-1 mb-1 ml-0 flex flex-1 flex-col overflow-hidden rounded-xl bg-card sm:mr-3 sm:mt-3 sm:mb-3"
      >
        <div className="rounded-t-[18px] bg-card">
          {header}
        </div>
        {children}
      </div>
    </div>
  );
}
