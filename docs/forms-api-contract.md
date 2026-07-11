# Forms API Contract

Set `VITE_FORMS_API_URL` to the API base URL. The dashboard keeps a local copy and uses this API when it is available.

## Endpoints

- `PUT /forms/:slug` accepts the complete form JSON and returns either the form object or `{ "form": form }`.
- `GET /forms/:slug` returns either the form object or `{ "form": form }`.
- `POST /forms/:slug/responses` accepts the complete response JSON and may return the saved response.
- `GET /forms/:formId/responses` returns either a response array or `{ "responses": [] }`.

The API must enforce published status, closing time, response limits, payload size, allowed file types, rate limits, and authorization for management endpoints. Public clients should only be allowed to read published forms and create responses.

## CORS

Allow the deployed dashboard origin for `GET`, `POST`, `PUT`, and `OPTIONS`. Never place a service-role key or server secret in a `VITE_` environment variable.
