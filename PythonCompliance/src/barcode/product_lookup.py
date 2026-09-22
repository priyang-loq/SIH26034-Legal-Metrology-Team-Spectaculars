import sys
import requests
import json


# ==========================================
# STANDARDIZED RESULT FORMAT
# ==========================================

def create_result(
    success,
    barcode,
    product_name=None,
    brand=None,
    company=None,
    category=None,
    quantity=None,
    ingredients=None,
    countries=None,
    source=None,
    message=None
):

    return {
        "success": success,
        "barcode": barcode,
        "product_name": product_name,
        "brand": brand,
        "company": company,
        "category": category,
        "quantity": quantity,
        "ingredients": ingredients,
        "countries": countries,
        "source": source,
        "message": message
    }


# ==========================================
# SOURCE 1: OPEN FOOD FACTS
# ==========================================

def lookup_open_food_facts(barcode):

    print("Searching Open Food Facts...", file=sys.stderr)

    url = f"https://world.openfoodfacts.net/api/v2/product/{barcode}"

    headers = {
        "User-Agent": "SIH26034-ProductLookup/1.0"
    }

    try:

        response = requests.get(
            url,
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:

            data = response.json()

            if data.get("status") == 1:

                product = data.get("product", {})

                return create_result(
                    success=True,
                    barcode=barcode,
                    product_name=product.get("product_name"),
                    brand=product.get("brands"),
                    company=product.get("owner"),
                    category=product.get("categories"),
                    quantity=product.get("quantity"),
                    ingredients=product.get("ingredients_text"),
                    countries=product.get("countries"),
                    source="Open Food Facts"
                )

        print("Not found in Open Food Facts.", file=sys.stderr)

    except requests.exceptions.RequestException as e:

        print(f"Open Food Facts error: {e}", file=sys.stderr)

    return None


# ==========================================
# SOURCE 2: UPC ITEM DATABASE
# ==========================================

def lookup_upcitemdb(barcode):

    print("Searching UPCitemdb...", file=sys.stderr)

    url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"

    try:

        response = requests.get(
            url,
            timeout=10
        )

        if response.status_code == 200:

            data = response.json()

            items = data.get("items", [])

            if items:

                product = items[0]

                return create_result(
                    success=True,
                    barcode=barcode,
                    product_name=product.get("title"),
                    brand=product.get("brand"),
                    category=product.get("category"),
                    quantity=None,
                    ingredients=product.get("description"),
                    source="UPCitemdb"
                )

        print("Not found in UPCitemdb.", file=sys.stderr)

    except requests.exceptions.RequestException as e:

        print(f"UPCitemdb error: {e}", file=sys.stderr)

    return None


import os

# ==========================================
# SOURCE 3: LOCAL DATABASE
# ==========================================

def lookup_local_database(barcode):

    print("Checking Local Product Database...", file=sys.stderr)

    try:
        db_path = os.path.join(os.path.dirname(__file__), "local_products.json")
        with open(
            db_path,
            "r",
            encoding="utf-8"
        ) as file:

            database = json.load(file)

        if barcode in database:

            product = database[barcode]

            return create_result(
                success=True,
                barcode=barcode,
                product_name=product.get("product_name"),
                brand=product.get("brand"),
                company=product.get("company"),
                category=product.get("category"),
                quantity=product.get("quantity"),
                ingredients=product.get("ingredients"),
                countries=product.get("countries"),
                source="Local Product Database"
            )

        print("Not found in Local Database.", file=sys.stderr)

    except FileNotFoundError:

        print("local_products.json not found.", file=sys.stderr)

    return None


# ==========================================
# MAIN MULTI-SOURCE ENGINE
# ==========================================

def lookup_product(barcode):

    barcode = str(barcode).strip()

    print("\nPRODUCT LOOKUP ENGINE", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    # Source 1
    result = lookup_open_food_facts(barcode)

    if result:
        return result

    # Source 2
    result = lookup_upcitemdb(barcode)

    if result:
        return result

    # Source 3
    result = lookup_local_database(barcode)

    if result:
        return result

    # Not found anywhere
    return create_result(
        success=False,
        barcode=barcode,
        source=None,
        message="Product not found in available databases"
    )


# ==========================================
# MANUAL TEST
# ==========================================

if __name__ == "__main__":

    barcode = input("\nEnter barcode: ")

    result = lookup_product(barcode)

    print("\nPRODUCT INFORMATION", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    for key, value in result.items():
        print(f"{key}: {value}", file=sys.stderr)