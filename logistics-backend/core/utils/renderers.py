from rest_framework.renderers import JSONRenderer


class CustomJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        # Protege contra data None e context ausente.
        response = (renderer_context or {}).get("response")

        success = True
        if response is not None and response.status_code >= 400:
            success = False

        # Não muta o objeto original de data; monta um payload limpo.
        response_data = {"success": success, "data": data if data is not None else {}}

        if isinstance(data, dict):
            if "detail" in data:
                response_data["detail"] = data["detail"]
            # remove chaves de controle do payload de dados
            response_data["data"] = {k: v for k, v in data.items() if k not in ("detail", "success")}

        return super().render(response_data, accepted_media_type, renderer_context)
