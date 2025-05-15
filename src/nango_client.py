import httpx
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Note: When using a self-hosted Nango instance, make sure to set:
# NANGO_BASE_URL=https://your-self-hosted-nango-instance.com

async def fetch_nango_credentials(
    connection_id: str,
    nango_base_url: str,
    nango_secret_key: str,
    provider_config_key: str, # e.g., 'google-analytics'
) -> dict | None:
    """Fetches credentials (including access token) from the Nango API.

    Args:
        connection_id: The unique Nango connection ID (often our agencyClientId).
        nango_base_url: The base URL of the Nango API.
        nango_secret_key: The Nango secret key for authentication.
        provider_config_key: The provider config key from Nango (e.g., 'google-analytics')

    Returns:
        The credentials dictionary containing the access token, or None if an error occurs.
    """
    if not all([connection_id, nango_base_url, nango_secret_key, provider_config_key]):
        logger.error("Nango client missing required arguments.")
        return None

    # Nango API endpoint to get connection details, forcing a refresh if needed
    # Using provider_config_key and connection_id as path params
    # Reference: https://docs.nango.dev/reference/api/connections/get
    url = f"{nango_base_url}/connection/{provider_config_key}/{connection_id}?force_refresh=true"
    headers = {"Authorization": f"Bearer {nango_secret_key}"}

    logger.info(f"Fetching Nango credentials for connection ID: {connection_id} from {url}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers)

            if response.status_code == 200:
                data = response.json()
                credentials = data.get("credentials")
                if credentials and credentials.get("access_token"):
                    logger.info(f"Successfully fetched Nango credentials for {connection_id}")
                    return credentials
                else:
                    logger.error(
                        f"Nango response for {connection_id} missing credentials or access token."
                    )
                    logger.debug(f"Nango raw response: {response.text}")
                    return None
            elif response.status_code == 404:
                 logger.error(f"Nango connection not found for ID: {connection_id}")
                 return None
            else:
                response.raise_for_status() # Raise an exception for other bad status codes (4xx, 5xx)

    except httpx.HTTPStatusError as e:
        logger.error(
            f"HTTP error fetching Nango credentials for {connection_id}: {e.response.status_code} - {e.response.text}"
        )
    except httpx.RequestError as e:
        logger.error(f"Network error fetching Nango credentials for {connection_id}: {e}")
    except Exception as e:
        logger.error(f"Unexpected error fetching Nango credentials for {connection_id}: {e}", exc_info=True)

    return None 