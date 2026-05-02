package httpjson

import (
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeRequest(t *testing.T) {
	var request struct {
		Name string `json:"name"`
	}
	response := httptest.NewRecorder()
	httpRequest := httptest.NewRequest("POST", "/", strings.NewReader(`{"name":"hub"}`))

	err := DecodeRequest(response, httpRequest, &request)

	if err != nil {
		t.Fatalf("DecodeRequest() error = %v, want nil", err)
	}
	if request.Name != "hub" {
		t.Fatalf("Name = %q, want hub", request.Name)
	}
}

func TestDecodeRequestRejectsMalformedJSON(t *testing.T) {
	var request struct {
		Name string `json:"name"`
	}
	response := httptest.NewRecorder()
	httpRequest := httptest.NewRequest("POST", "/", strings.NewReader(`{"name":`))

	err := DecodeRequest(response, httpRequest, &request)

	if err == nil {
		t.Fatal("DecodeRequest() error = nil, want malformed JSON error")
	}
	if errors.Is(err, ErrRequestBodyTooLarge) {
		t.Fatalf("DecodeRequest() error = %v, want non-size JSON error", err)
	}
}

func TestDecodeRequestRejectsOversizedJSONWithoutContentLength(t *testing.T) {
	var request struct {
		Name string `json:"name"`
	}
	response := httptest.NewRecorder()
	body := `{"name":"` + strings.Repeat("a", int(MaxRequestBodyBytes)+1) + `"}`
	httpRequest := httptest.NewRequest("POST", "/", strings.NewReader(body))
	httpRequest.ContentLength = -1

	err := DecodeRequest(response, httpRequest, &request)

	if !errors.Is(err, ErrRequestBodyTooLarge) {
		t.Fatalf("DecodeRequest() error = %v, want ErrRequestBodyTooLarge", err)
	}
}
