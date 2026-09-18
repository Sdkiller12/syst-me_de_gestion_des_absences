export const APP_NAME = "Gestion des absences";

export const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "Retard",
  JUSTIFIED: "Justifié",
};

export const NOTIFICATION_LABELS: Record<string, string> = {
  SENT: "Envoyé",
  PENDING: "En attente",
  FAILED: "Échec",
};

export const IVORIAN_PHONE_REGEX = /^(?:\+225)?0[157]\d{8}$/;
