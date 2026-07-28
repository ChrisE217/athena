export function ShotWindow({
  src,
  title,
  zoom,
}: {
  src: string;
  title: string;
  zoom?: boolean;
}) {
  return (
    <div className="win" data-zoom={zoom}>
      <div className="win-bar">
        <span className="win-lights">
          <i className="light-close" />
          <i className="light-min" />
          <i className="light-max" />
        </span>
        <span className="win-title">{title}</span>
      </div>
      <img className="win-img" src={src} alt={title} />
    </div>
  );
}
