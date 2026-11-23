import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** 舊連結導向工作區 */
export default async function DocumentDetailPage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/workspace?doc=${id}`);
}
