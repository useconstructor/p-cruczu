# Gastos AWS API

Registro personal en español con Next.js 16, Tailwind 4, componentes shadcn/ui y persistencia en Turso. No incluye registros iniciales.

## Configuración del servidor

- `TURSO_DATABASE_URL`: URL de la base Turso.
- `TURSO_AUTH_TOKEN`: credencial Turso, exclusivamente del servidor.
- `APP_ORIGIN`: origen completo de la aplicación, por ejemplo el dominio HTTPS asignado por el host, sin ruta. En Vercel también se reconocen `VERCEL_URL` y `VERCEL_PROJECT_PRODUCTION_URL`. Un dominio personalizado debe configurarse con `APP_ORIGIN`. El origen del documento de la app sigue siendo el mismo cuando está dentro de un iframe; no se autoriza el dominio padre por ese motivo.
- `NEXT_PUBLIC_CONSTRUCTOR_API` y `NEXT_PUBLIC_PROJECT_ID`: configuración pública del script de analítica. Solo se emiten nombres de eventos; nunca campos del formulario.

Sin un origen de despliegue configurado, solo se aceptan los orígenes locales explícitos de los puertos 3000 y 3100. Las mutaciones requieren un encabezado `Origin` autorizado y un objeto JSON. No se confía en los encabezados Host ni forwarded para autorizar escrituras.

```sh
npm install
npm run dev
npm run lint
npm run build
npm run start
```

## Persistencia y migración

`migrations/001_expenses.sql` contiene el esquema reproducible. `lib/db.ts` lo aplica antes del primer acceso, dentro de una transacción. Si existe el esquema anterior con `amount_minor`, conserva IDs, fechas, centavos y timestamps al migrar a `amount_centavos`. Datos antiguos incompatibles con los límites nuevos abortan la migración completa: no se truncan ni eliminan registros.

Los importes se intercambian como cadenas de centavos y se suman con BigInt. `GET /api/gastos?q=` devuelve movimientos filtrados, total y cantidad globales y categorías persistidas desde una misma lectura. Las escrituras usan `POST /api/gastos`, `POST /api/gastos/[id]/editar` y `POST /api/gastos/[id]/eliminar` (este último con `{}`). El único workflow publicado es la lectura Actualizar.

Para pruebas aisladas se admite una URL `file:` mediante el mismo cliente libsql. Esa opción no sustituye la configuración Turso del entorno publicado. Las evidencias y el verificador de interacción se guardan fuera del proyecto, en `/tmp/constructor-quality/`.
