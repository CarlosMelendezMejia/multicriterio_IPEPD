"""
WSGI Configuration con soporte para prefijo de ruta (APP_PREFIX)
Permite montar la aplicación bajo una subruta.
Ejemplo:
  APP_PREFIX=multicriterio_ipepd gunicorn wsgi:application
"""

import os
from dotenv import load_dotenv
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from werkzeug.wrappers import Response

# Cargar variables de entorno (.env)
load_dotenv()

# Importar la aplicación Flask
# (app.py expone "app = create_app()")
from app import app

# Obtener prefijo de la ruta desde variable de entorno
# Normalizar: remover barras al inicio y al final
APP_PREFIX = os.getenv("APP_PREFIX", "").strip().strip("/")


def simple_app(environ, start_response):
    """Aplicación simple para la raíz cuando se usa prefijo"""
    prefix_path = f"/{APP_PREFIX}" if APP_PREFIX else "/"
    response = Response(
        "Sistema Multicriterio IPEPD. "
        f"La aplicación está montada en: {prefix_path}",
        mimetype="text/plain",
    )
    return response(environ, start_response)


# Si hay un prefijo, usar DispatcherMiddleware
if APP_PREFIX:
    application = DispatcherMiddleware(simple_app, {f"/{APP_PREFIX}": app})
    print(f"✓ Aplicación montada en subruta: /{APP_PREFIX}")
    print(f"✓ URL de acceso: http://localhost:5000/{APP_PREFIX}/")
else:
    application = app
    print("✓ Aplicación montada en la raíz: /")
    print("✓ URL de acceso: http://localhost:5000/")

# Para usar con servidores WSGI como Gunicorn:
# gunicorn wsgi:application
