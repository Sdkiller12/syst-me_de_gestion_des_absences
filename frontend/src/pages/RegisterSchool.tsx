import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../layouts/DashboardLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/AuthContext";
import { APP_NAME } from "../constants";
import { registerSchoolSchema } from "../schemas";
import type { RegisterSchoolInput } from "../schemas";

export function RegisterSchool() {
  const { registerSchool } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterSchoolInput>({ resolver: zodResolver(registerSchoolSchema) });

  async function onSubmit(values: RegisterSchoolInput) {
    setServerError("");
    try {
      await registerSchool({
        schoolName: values.schoolName,
        schoolEmail: values.schoolEmail || undefined,
        schoolPhone: values.schoolPhone || undefined,
        city: values.city || undefined,
        adminFirstName: values.adminFirstName,
        adminLastName: values.adminLastName,
        adminEmail: values.adminEmail,
        adminPassword: values.adminPassword,
        adminPhone: values.adminPhone || undefined,
      });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Inscription impossible.");
    }
  }

  return (
    <AuthLayout>
      <Card className="w-full max-w-xl">
        <h1 className="text-xl font-semibold text-[#0F172A]">Créer votre espace {APP_NAME}</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          Enregistrez votre établissement puis votre compte administrateur. Aucune donnée de démonstration ne sera créée.
        </p>
        <form className="mt-5 space-y-4" onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <h2 className="text-sm font-semibold text-[#0F172A]">Établissement</h2>
          <Input label="Nom de l'école *" error={errors.schoolName?.message} {...register("schoolName")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Email école" type="email" error={errors.schoolEmail?.message} {...register("schoolEmail")} />
            <Input label="Téléphone école" error={errors.schoolPhone?.message} {...register("schoolPhone")} />
          </div>
          <Input label="Ville" error={errors.city?.message} {...register("city")} />
          <h2 className="text-sm font-semibold text-[#0F172A]">Administrateur</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Prénom *" error={errors.adminFirstName?.message} {...register("adminFirstName")} />
            <Input label="Nom *" error={errors.adminLastName?.message} {...register("adminLastName")} />
          </div>
          <Input label="Email *" type="email" autoComplete="email" error={errors.adminEmail?.message} {...register("adminEmail")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Mot de passe * (8 caractères min)" type="password" autoComplete="new-password" error={errors.adminPassword?.message} {...register("adminPassword")} />
            <Input label="Téléphone" error={errors.adminPhone?.message} {...register("adminPhone")} />
          </div>
          {serverError ? <p className="text-sm text-[#DC2626]">{serverError}</p> : null}
          <Button type="submit" loading={isSubmitting} className="w-full">
            Créer mon espace école
          </Button>
          <p className="text-center text-sm text-[#64748B]">
            Déjà un compte ?{" "}
            <Link to="/login" className="font-medium text-[#2563EB] hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </Card>
    </AuthLayout>
  );
}
