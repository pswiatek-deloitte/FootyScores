export async function fetchJson(
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetchImpl(sourceUrl, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new Error(`Could not fetch JSON from ${sourceUrl}`, {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(
      `JSON request failed with HTTP ${response.status} ${response.statusText}`,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error(`JSON response from ${sourceUrl} was not valid JSON`, {
      cause: error,
    });
  }
}
