import { HostInterview } from "@/components/host-interview";
import { PhoneShell } from "@/components/phone-shell";

export default function HostPage() {
  return (
    <PhoneShell eyebrow="New receipt">
      <HostInterview />
    </PhoneShell>
  );
}
