import asyncio, sys
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from core.translator import generate_product_content_translations


async def main():
    await generate_product_content_translations(only_missing=True)

if __name__ == "__main__":
    asyncio.run(main())
