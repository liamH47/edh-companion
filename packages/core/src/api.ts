import type { CardMetadata, FieldValues, OutputValues } from './types'

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${response.status} ${response.statusText}: ${body}`)
  }
  return (await response.json()) as T
}

export function listCards(): Promise<CardMetadata[]> {
  return fetchJson<CardMetadata[]>('/api/cards')
}

export function getCard(cardId: string): Promise<CardMetadata> {
  return fetchJson<CardMetadata>(`/api/cards/${cardId}`)
}

export function calculateCard(
  cardId: string,
  inputs: FieldValues,
  signal?: AbortSignal,
): Promise<{ outputs: OutputValues }> {
  return fetchJson(`/api/cards/${cardId}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs }),
    signal,
  })
}
