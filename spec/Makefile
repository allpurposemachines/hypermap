BIKESHED = $(shell command -v uv >/dev/null 2>&1 && echo "uv tool run bikeshed" || echo "pipx run bikeshed")

all: index.html

index.html: index.bs
	$(BIKESHED) spec index.bs index.html

watch:
	$(BIKESHED) watch index.bs index.html

clean:
	rm -f index.html

.PHONY: all watch clean
