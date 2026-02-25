BIKESHED = uv tool run bikeshed

all: index.html

index.html: index.bs
	$(BIKESHED) spec index.bs index.html

watch:
	$(BIKESHED) watch index.bs index.html

clean:
	rm -f index.html

.PHONY: all watch clean
