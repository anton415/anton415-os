package httpjson

import (
	"encoding/json"
	"errors"
	"net/http"
)

const MaxRequestBodyBytes int64 = 64 * 1024

var ErrRequestBodyTooLarge = errors.New("json request body too large")

func DecodeRequest(w http.ResponseWriter, r *http.Request, value any) error {
	if r.ContentLength > MaxRequestBodyBytes {
		return ErrRequestBodyTooLarge
	}

	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, MaxRequestBodyBytes))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			return ErrRequestBodyTooLarge
		}
		return err
	}

	return nil
}
