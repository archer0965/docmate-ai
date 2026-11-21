/**
 * Dashboard 群組 layout
 * 環境變數檢查改在各 page 最前方執行（Next 會並行跑 page，layout 擋不住）
 */
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
