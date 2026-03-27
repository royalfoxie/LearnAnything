import sys
import json
from sympy import *
import logging

# Rejestracja Docling - biblioteki do superszybkiej ekstrakcji strukturalnej PDF z AI (tabele, tekst, nagłówki).
# Pamiętaj o posiadaniu wersji PyTorch pod AMD/ROCm jeśli akceleracja ma działać. W przeciwnym razie zrzuci wątki na procesor (CPU).
try:
    from docling.document_converter import DocumentConverter
except ImportError:
    DocumentConverter = None

logging.basicConfig(level=logging.WARNING)

def handle_query(query):
    try:
        action = query.get("action")
        
        if action == "simplify":
            expr = sympify(query.get("expression"))
            simplified = simplify(expr)
            return {"status": "ok", "result": str(simplified)}
            
        elif action == "extract_pdf":
            if DocumentConverter is None:
                return {"status": "error", "message": "Brak paczki docling. Zainstaluj bibliotekę w środowisku venv."}
                
            path = query.get("path")
            converter = DocumentConverter()
            converted_doc = converter.convert(path)
            md_content = converted_doc.document.export_to_markdown()
            
            # Wyrzucamy czysty Markdown zachowujący drzewo nagłówków M.A.S.
            return {"status": "ok", "result": md_content}
            
        else:
            return {"status": "error", "message": "Nieznana akcja API Rusta"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    for line in sys.stdin:
        try:
            req = json.loads(line)
            res = handle_query(req)
            print(json.dumps(res), flush=True)
        except Exception as e:
            print(json.dumps({"status": "error", "message": "Błąd mapowania JSON: " + str(e)}), flush=True)
