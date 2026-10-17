import 'server-only';

let teamPhone: string | null = null;

export function getResponseTeamWhatsApp(): string {
  if (teamPhone) return teamPhone;

  const raw = process.env.RESPONSE_TEAM_WHATSAPP;
  if (!raw || raw.trim() === '') {
    throw new Error('RESPONSE_TEAM_WHATSAPP es requerido (número del equipo de respuesta)');
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    throw new Error(
      'RESPONSE_TEAM_WHATSAPP debe contener entre 9 y 15 dígitos (formato internacional, p. ej. 51987654321)',
    );
  }

  teamPhone = digits;
  return teamPhone;
}
