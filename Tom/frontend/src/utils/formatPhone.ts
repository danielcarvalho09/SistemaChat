/**
 * Formata número de telefone brasileiro
 * Exemplos:
 * - 5516999999999 → +55 (16) 99999-9999
 * - 551633333333 → +55 (16) 3333-3333
 * - 16999999999 → (16) 99999-9999
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remover caracteres não numéricos
  const cleaned = phone.replace(/\D/g, '');

  // Número com código do país (55)
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    const countryCode = cleaned.slice(0, 2);
    const areaCode = cleaned.slice(2, 4);
    const number = cleaned.slice(4);

    // Celular (9 dígitos)
    if (number.length === 9) {
      return `+${countryCode} (${areaCode}) ${number.slice(0, 5)}-${number.slice(5)}`;
    }
    // Fixo (8 dígitos)
    else if (number.length === 8) {
      return `+${countryCode} (${areaCode}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }
  }

  // Número sem código do país
  if (cleaned.length >= 10) {
    const areaCode = cleaned.slice(0, 2);
    const number = cleaned.slice(2);

    // Celular (9 dígitos)
    if (number.length === 9) {
      return `(${areaCode}) ${number.slice(0, 5)}-${number.slice(5)}`;
    }
    // Fixo (8 dígitos)
    else if (number.length === 8) {
      return `(${areaCode}) ${number.slice(0, 4)}-${number.slice(4)}`;
    }
  }

  // Retornar original se não conseguir formatar
  return phone;
}

/**
 * Remove formatação do número
 * Exemplo: +55 (16) 99999-9999 → 5516999999999
 */
export function unformatPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Valida se é um número de telefone brasileiro válido
 */
export function isValidBrazilianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  
  // Com código do país: 55 + DDD (2) + número (8 ou 9)
  if (cleaned.startsWith('55')) {
    return cleaned.length === 12 || cleaned.length === 13;
  }
  
  // Sem código do país: DDD (2) + número (8 ou 9)
  return cleaned.length === 10 || cleaned.length === 11;
}
