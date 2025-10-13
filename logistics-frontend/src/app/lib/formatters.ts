export const formatPrice = (value: number | string): string => {
    try {
        const num = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(num)) return '';
        return num.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})
    } catch {
        return '';
    }
}

export const formatMinutes = (value: number | string): string => {
    const num = typeof value === "number" ? value : parseInt(value, 10);

    if (isNaN(num) || num < 0) return "";

    const hours = Math.floor(num / 60)
    const minutes = num % 60

    if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
    }
    
    if (hours > 0) {
        return `${hours}h`
    }

    return `${minutes}m`
}

**
 * Formata peso em kg com unidade
 * Exemplos: 1500 → "1.500 kg" | 0.5 → "500 g"
 */
export const formatPeso = (value: number | string): string => {
    try {
        const num = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(num)) return '';
        
        // Se for menos de 1kg, mostra em gramas
        if (num < 1) {
            return `${(num * 1000).toFixed(0)} g`;
        }
        
        // Se for 1kg ou mais, mostra em kg
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        }) + ' kg';
    } catch {
        return '';
    }
}

/**
 * Formata volume em m³
 * Exemplo: 1.5 → "1,500 m³"
 */
export const formatVolume = (value: number | string | null): string => {
    if (value === null || value === undefined) return '-';
    
    try {
        const num = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(num)) return '-';
        
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        }) + ' m³';
    } catch {
        return '-';
    }
}

/**
 * Formata distância em km
 * Exemplos: 5.234 → "5,2 km" | 0.8 → "800 m"
 */
export const formatDistancia = (value: number | string): string => {
    try {
        const num = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(num)) return '';
        
        // Se for menos de 1km, mostra em metros
        if (num < 1) {
            return `${(num * 1000).toFixed(0)} m`;
        }
        
        // Se for 1km ou mais
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1
        }) + ' km';
    } catch {
        return '';
    }
}

/**
 * Formata data no padrão brasileiro
 * Exemplo: "2025-01-15" → "15/01/2025"
 */
export const formatData = (value: string): string => {
    try {
        const date = new Date(value + 'T00:00:00'); // Evita problema de timezone
        return date.toLocaleDateString('pt-BR');
    } catch {
        return '';
    }
}

/**
 * Formata data e hora completa
 * Exemplo: "2025-01-15T14:30:00" → "15/01/2025 às 14:30"
 */
export const formatDataHora = (value: string): string => {
    try {
        const date = new Date(value);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '';
    }
}

/**
 * Formata percentual
 * Exemplo: 85.5 → "85,5%"
 */
export const formatPercentual = (value: number | string): string => {
    try {
        const num = typeof value === "number" ? value : parseFloat(value);
        if (isNaN(num)) return '0%';
        
        return num.toLocaleString('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1
        }) + '%';
    } catch {
        return '0%';
    }
}

/**
 * Formata número de nota fiscal
 * Exemplo: 12345 → "NF 12.345"
 */
export const formatNF = (value: number | string): string => {
    try {
        const num = typeof value === "number" ? value : parseInt(value, 10);
        if (isNaN(num)) return '';
        
        return 'NF ' + num.toLocaleString('pt-BR');
    } catch {
        return '';
    }
}

/**
 * Calcula percentual de utilização da capacidade
 * Exemplo: (800, 1000) → 80
 */
export const calcularUtilizacao = (pesoUsado: number, capacidadeMax: number): number => {
    if (capacidadeMax === 0) return 0;
    return (pesoUsado / capacidadeMax) * 100;
}

/**
 * Retorna cor baseada no percentual de capacidade
 * Usa as constantes do logistics-colors.ts
 */
export const getCapacidadeColor = (percentual: number): string => {
    if (percentual > 100) return '#dc2626';  // Excedida - vermelho escuro
    if (percentual > 90) return '#fc624a';   // Alta - vermelho
    if (percentual > 70) return '#feb134';   // Média - laranja
    return '#10b981';                        // Baixa - verde
}

/**
 * Retorna texto descritivo da capacidade
 */
export const getCapacidadeTexto = (percentual: number): string => {
    if (percentual > 100) return 'Capacidade excedida';
    if (percentual > 90) return 'Capacidade alta';
    if (percentual > 70) return 'Capacidade média';
    return 'Capacidade disponível';
}

/**
 * Trunca texto longo com reticências
 * Exemplo: ("Observação muito longa aqui", 20) → "Observação muito lo..."
 */
export const truncateText = (text: string | null, maxLength: number): string => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Formata coordenadas geográficas
 * Exemplo: (-30.0346, -51.2177) → "30°02'S, 51°13'W"
 */
export const formatCoordenadas = (lat: number, lng: number): string => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    
    const latAbs = Math.abs(lat);
    const lngAbs = Math.abs(lng);
    
    const latDeg = Math.floor(latAbs);
    const latMin = Math.floor((latAbs - latDeg) * 60);
    
    const lngDeg = Math.floor(lngAbs);
    const lngMin = Math.floor((lngAbs - lngDeg) * 60);
    
    return `${latDeg}°${latMin}'${latDir}, ${lngDeg}°${lngMin}'${lngDir}`;
}

/**
 * Calcula distância entre dois pontos usando Haversine
 * Retorna distância em quilômetros
 */
export const calcularDistancia = (
    lat1: number, 
    lon1: number, 
    lat2: number, 
    lon2: number
): number => {
    const R = 6371; // Raio da Terra em km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
}

// Função auxiliar para converter graus para radianos
const toRad = (degrees: number): number => {
   return degrees * (Math.PI / 180);
}