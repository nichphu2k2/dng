export default function PlaceholderPage({ title }) {
  return (
    <div className="dashboard-page">
      <section className="page-hero">
        <div>
          <p className="eyebrow">Trang dang cap nhat</p>
          <h1>{title}</h1>
          <p>
            Noi dung cho trang nay chua duoc trien khai. Ban co the tiep tuc su dung thanh dieu huong va
            quay lai sau khi tinh nang duoc hoan thien.
          </p>
        </div>
        <div className="hero-badge">
          <span className="hero-badge-title">Coming Soon</span>
          <span>Tinh nang se duoc bo sung trong phien ban tiep theo.</span>
        </div>
      </section>
    </div>
  );
}
