import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useAuth } from "../hooks/AuthContext";
import { changePasswordSchema } from "../schemas";
import type { ChangePasswordInput } from "../schemas";
import type { User } from "../types";

/** Formulaire de changement de mot de passe (premier accès, profil, paramètres) */
export function ChangePasswordForm({
  user,
  submitLabel = "Changer le mot de passe",
  currentLabel = "Mot de passe actuel",
  onDone,
}: {
  user?: User | null;
  submitLabel?: string;
  currentLabel?: string;
  onDone?: (user: User) => void;
}) {
  const { changePassword } = useAuth();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordInput) {
    setServerError("");
    try {
      const user = await changePassword(values.currentPassword, values.newPassword);
      reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onDone?.(user);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Changement impossible.");
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
      {user && <input type="hidden" autoComplete="username" value={user.username ?? user.email ?? ""} />}
      <Input label={currentLabel} type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register("currentPassword")} />
      <Input
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        hint="8 caractères minimum, avec une majuscule, une minuscule et un chiffre."
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <Input label="Confirmer le nouveau mot de passe" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
      {serverError ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          {serverError}
        </p>
      ) : null}
      <Button type="submit" loading={isSubmitting} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
