# Cloud Taller 3

## Tecnologías utilizadas

- **Frontend:** React + Vite.
- **Backend:** Node.js + Express.
- **Infraestructura:** Terraform.
- **Emulación de AWS:** LocalStack con S3.
- **Contenerización:** Docker y Docker Compose.
- **Commits:** Conventional Commits.


## Cómo ejecutar el proyecto

Desde la raíz del proyecto:

```powershell
docker compose up -d --build
```

Si quieres ejecutar Terraform manualmente

```powershell
docker compose run --rm terraform init
docker compose run --rm terraform apply -auto-approve


```
### Variables de entorno del backend

El backend usa estas variables:

- `PORT=3001`
- `AWS_REGION=us-east-1`
- `AWS_ACCESS_KEY_ID=test`
- `AWS_SECRET_ACCESS_KEY=test`
- `S3_ENDPOINT_URL=http://localstack:4566`
- `S3_BUCKET_NAME=taller3-bucket`
- `S3_FORCE_PATH_STYLE=true`
- `MAX_FILE_SIZE=104857600`

- `VITE_API_URL=http://localhost:3001`

