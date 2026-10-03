const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'; // no l
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
const DIGITS = '23456789'; // no 0, 1
const SYMBOLS = '!@#$%^&*_-+=?';

export interface PasswordGeneratorOptions {
  length: number;
  useLower: boolean;
  useUpper: boolean;
  useDigits: boolean;
  useSymbols: boolean;
}

export function generatePassword(options: PasswordGeneratorOptions): string {
  let charset = '';
  const guaranteed: string[] = [];

  if (options.useLower) {
    charset += LOWERCASE;
    guaranteed.push(getRandomChar(LOWERCASE));
  }
  if (options.useUpper) {
    charset += UPPERCASE;
    guaranteed.push(getRandomChar(UPPERCASE));
  }
  if (options.useDigits) {
    charset += DIGITS;
    guaranteed.push(getRandomChar(DIGITS));
  }
  if (options.useSymbols) {
    charset += SYMBOLS;
    guaranteed.push(getRandomChar(SYMBOLS));
  }

  if (charset.length === 0) {
    charset = LOWERCASE + DIGITS;
  }

  const length = Math.max(12, Math.min(48, options.length || 20));
  const remainingCount = length - guaranteed.length;
  const randomBytes = crypto.getRandomValues(new Uint8Array(remainingCount));

  const chars: string[] = [...guaranteed];
  for (let i = 0; i < remainingCount; i++) {
    chars.push(charset[randomBytes[i] % charset.length]);
  }

  // Fisher-Yates shuffle with crypto.getRandomValues
  for (let i = chars.length - 1; i > 0; i--) {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[r];
    chars[r] = tmp;
  }

  return chars.join('');
}

function getRandomChar(str: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(1));
  return str[bytes[0] % str.length];
}

const COMMON_PASSWORDS = new Set([
  '123456', '12345678', '123456789', 'password', 'qwerty', 'admin', 'welcome',
  '12345', '1234567', 'secret', 'contraseña', 'contrasena', 'hola123', 'admin123',
  'pass123', 'usuario', 'root', 'superman', 'iloveyou', 'starwars', 'master',
  'umbra', 'bubbas', 'ods', '111111', '000000', '123123', 'abc123'
]);

export interface StrengthInfo {
  score: number; // 0 to 4
  label: 'Muy débil' | 'Débil' | 'Aceptable' | 'Fuerte' | 'Excelente';
  color: string;
}

export function evaluatePasswordStrength(password: string): StrengthInfo {
  if (!password || password.length === 0) {
    return { score: 0, label: 'Muy débil', color: '#c45c4a' };
  }

  const clean = password.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(clean)) {
    return { score: 0, label: 'Muy débil', color: '#c45c4a' };
  }

  if (password.length < 8) {
    return { score: 0, label: 'Muy débil', color: '#c45c4a' };
  }

  let points = 0;

  // Length points
  if (password.length >= 10) points += 1;
  if (password.length >= 14) points += 1;
  if (password.length >= 20) points += 1;

  // Variety points
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  const varietyCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (varietyCount >= 3) points += 1;
  if (varietyCount === 4) points += 1;

  // Map points (0-5) to 0-4
  let score = 0;
  if (points <= 1) score = 1; // Débil
  else if (points <= 2) score = 2; // Aceptable
  else if (points <= 3) score = 3; // Fuerte
  else score = 4; // Excelente

  const labels: Array<'Muy débil' | 'Débil' | 'Aceptable' | 'Fuerte' | 'Excelente'> = [
    'Muy débil',
    'Débil',
    'Aceptable',
    'Fuerte',
    'Excelente'
  ];

  const colors = [
    '#c45c4a', // destructive red
    '#c47a50', // orange
    '#c4a56a', // warn yellow
    '#8faf89', // ok green
    '#68b97c'  // bright green
  ];

  return {
    score,
    label: labels[score],
    color: colors[score]
  };
}
