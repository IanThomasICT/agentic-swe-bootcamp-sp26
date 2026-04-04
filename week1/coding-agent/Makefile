.PHONY: go ts cs slides lint-slides

go:
	cd go && go run .

ts:
	cd ts && bun dev

cs:
	cd cs && dotnet run

slides:
	cd slides && bunx slidev --open

lint-slides:
	cd slides && bunx eslint slides.md
