import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth, roleLabel } from "../hooks/AuthContext";
import { useSchool } from "../hooks/useApi";
import { schoolService } from "../services/school.service";
import { smsConfigService } from "../services/admin.service";
import { apiBaseURL } from "../services/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { LoadingState } from "../components/ui/LoadingState";
import { Select } from "../components/ui/Select";
import { useToast } from "../components/ui/Toast";

export function Settings() {
  const { user, logout } = useAuth();
  const school = useSchool();
  const { notify } = useToast();
  const [smsProvider, setSmsProvider] = useState("mock");
  const [smsSender, setSmsSender] = useState("");
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm<{ name: string; city: string; phone: string }>();

  useEffect(() => {
    if (school.data) reset({ name: school.data.name, city: school.data.city ?? "", phone: school.data.phone ?? "" });
  }, [school.data, reset]);

  useEffect(() => {
    if (user?.role === "SCHOOL_ADMIN" || user?.role === "SUPER_ADMIN") {
      void smsConfigService.get().then((cfg) => {
        if (cfg) {
          setSmsProvider(cfg.provider);
          setSmsSender(cfg.senderId ?? "");
        }
      }).catch(() => undefined);
    }
  }, [user]);

  async function onSchoolSubmit(values: { name: string; city: string; phone: string }) {
    try {
      await schoolService.update(values);
      notify("Établissement mis à jour");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    }
  }

  async function onSmsSubmit() {
    setSaving(true);
    try {
      if (smsProvider === "production") {
        notify("Renseignez SMS_API_URL et SMS_API_KEY côté serveur avant d'activer la production.", "error");
        return;
      }
      await smsConfigService.save({ provider: smsProvider as "mock" | "production", senderId: smsSender || null });
      notify("Configuration SMS enregistrée");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[#0F172A]">Paramètres</h1>
      <Card>
        <h2 className="text-base font-semibold">Profil</h2>
        <p className="mt-1 text-sm text-[#475569]">{user?.name} — {user?.email}</p>
        <p className="text-xs text-[#64748B]">Rôle : {user ? roleLabel(user.role) : ""}</p>
        <div className="mt-3">
          <Button variant="secondary" onClick={logout}>Se déconnecter</Button>
        </div>
      </Card>
      <Card>
        <h2 className="text-base font-semibold">Établissement</h2>
        {school.isLoading ? <LoadingState label="Chargement…" /> : (
          <form className="mt-3 space-y-3" onSubmit={(e) => void handleSubmit(onSchoolSubmit)(e)}>
            <Input label="Nom" {...register("name")} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Ville" {...register("city")} />
              <Input label="Téléphone" {...register("phone")} />
            </div>
            <Button type="submit">Enregistrer</Button>
          </form>
        )}
      </Card>
      {(user?.role === "SCHOOL_ADMIN" || user?.role === "SUPER_ADMIN") ? (
        <Card>
          <h2 className="text-base font-semibold">Fournisseur SMS</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Le mode production nécessite SMS_API_URL et SMS_API_KEY configurés côté serveur. Les clés ne sont jamais affichées ici.
          </p>
          <div className="mt-3 space-y-3">
            <Select label="Fournisseur" value={smsProvider} onChange={(e) => setSmsProvider(e.target.value)} options={[{ value: "mock", label: "mock (développement/tests uniquement)" }, { value: "production", label: "production" }]} />
            <Input label="Sender ID" value={smsSender} onChange={(e) => setSmsSender(e.target.value)} placeholder="ECOLE" />
            <Button onClick={() => void onSmsSubmit()} loading={saving}>Enregistrer</Button>
          </div>
        </Card>
      ) : null}
      <Card>
        <h2 className="text-base font-semibold">Connexion API</h2>
        <p className="text-xs text-[#64748B]">API : {apiBaseURL} — données 100% PostgreSQL, aucune donnée simulée.</p>
      </Card>
    </div>
  );
}
