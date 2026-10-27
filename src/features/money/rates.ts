import { periodKey } from '../../domain/horizons';

export interface FetchedRate { x100: number; date: string; source: string }

async function getJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

const reasonable = (value: number) => Number.isFinite(value) && value > 0 && value < 1e11;

/**
 * Fetch today's price of one US dollar in the reporting unit. This only asks a public service for a
 * number: no account, balance or transaction ever leaves the device. The user reviews the value before it is saved.
 *  - Toman/Rial: the Iranian market price of USDT (a dollar-pegged token) on a public exchange ticker,
 *    because official bank rates differ greatly from the rate people actually pay.
 *  - Anything else: a public daily reference rate.
 */
export async function fetchUsdRate(unit: string): Promise<FetchedRate> {
  const label = unit.trim().toLowerCase();
  const today = periodKey('day', new Date());
  if (label === 'toman' || label === 'rial') {
    const factor = label === 'rial' ? 10 : 1;
    const errors: string[] = [];
    try {
      const tickers: { symbol: string; price: string }[] = await getJson('https://api.bitpin.ir/api/v1/mkt/tickers/');
      const price = Number(tickers.find((t) => t.symbol === 'USDT_IRT')?.price);
      if (reasonable(price)) return { x100: Math.round(price * factor * 100), date: today, source: 'Bitpin USDT/IRT market price' };
      errors.push('Bitpin returned no usable price');
    } catch (error) { errors.push(`Bitpin: ${error instanceof Error ? error.message : 'failed'}`); }
    try {
      const markets = await getJson('https://api.wallex.ir/v1/markets');
      const price = Number(markets?.result?.symbols?.USDTTMN?.stats?.lastPrice);
      if (reasonable(price)) return { x100: Math.round(price * factor * 100), date: today, source: 'Wallex USDT/TMN market price' };
      errors.push('Wallex returned no usable price');
    } catch (error) { errors.push(`Wallex: ${error instanceof Error ? error.message : 'failed'}`); }
    throw new Error(`Could not reach a rate source (${errors.join('; ')}). Check your connection or type the rate yourself.`);
  }
  const code = unit.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('Online rates are available for Toman, Rial and 3-letter currency codes like EUR. Type the rate yourself for this unit.');
  const data = await getJson('https://open.er-api.com/v6/latest/USD');
  const rate = Number(data?.rates?.[code]);
  if (!reasonable(rate)) throw new Error(`No rate was found for ${code}.`);
  const updatedAt = Number(data?.time_last_update_unix);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
    throw new Error('The rate source did not provide a valid update date.');
  }
  const date = new Date(updatedAt * 1000).toISOString().slice(0, 10);
  return { x100: Math.round(rate * 100), date, source: 'open.er-api.com daily reference rate' };
}
