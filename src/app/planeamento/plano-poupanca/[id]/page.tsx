import { redirect } from "next/navigation";

export default async function PlaneamentoPlanLegacyRedirect(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/plano/plano-poupanca/${id}`);
}
