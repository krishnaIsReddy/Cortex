import httpx
import respx

from src.services.alerting.notifiers.slack import SlackNotifier

URL = "https://hooks.slack.com/services/T000/B000/XXXX"

@respx.mock
def test_send_returns_true_on_success():
    route = respx.post(URL).mock(return_value=httpx.Response(200, text="ok"))

    assert SlackNotifier().send(URL, {"text": "hi"}) is True
    assert route.called

@respx.mock
def test_send_returns_false_on_http_error():
    respx.post(URL).mock(return_value=httpx.Response(404, text="no_service"))

    assert SlackNotifier().send(URL, {"text": "hi"}) is False

@respx.mock
def test_send_returns_false_on_network_error():
    respx.post(URL).mock(side_effect=httpx.ConnectError("boom"))

    assert SlackNotifier().send(URL, {"text": "hi"}) is False
