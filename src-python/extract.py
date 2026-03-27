import sys
import json
import logging
# Wyłącz ostrzeżenia by zbytnie logi nie brudziły stdout (z którego RUST odczyta JSON z wynikiem)
logging.basicConfig(level=logging.ERROR)

def process_file(path_to_pdf):
    try:
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
        result = converter.convert(path_to_pdf)
        markdown_content = result.document.export_to_markdown()
        
        output = {"status": "ok", "result": markdown_content}
        print(json.dumps(output))
    except ImportError:
        err = {"status": "error", "message": "Biblioteka docling nie została zainstalowana. Uruchom: pip install docling w katalogu /venv/."}
        print(json.dumps(err))
    except Exception as e:
        err = {"status": "error", "message": str(e)}
        print(json.dumps(err))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "Brak ścieżki do pliku"}))
        sys.exit(1)
    process_file(sys.argv[1])
