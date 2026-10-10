-include .env

# Reinstalls only when the lockfile changes, so every target can depend on it.
node_modules: package-lock.json
	@npm ci
	@touch node_modules

.PHONY: install
install: node_modules

.PHONY: dev
dev: install
	@npx vite

.PHONY: build
build: install
	@npm run build

.PHONY: preview
preview: build
	@npx vite preview

.PHONY: lint
lint: install
	@echo "Running biome lint with fix..."
	@npx biome lint --write .

.PHONY: lint-check
lint-check: install
	@echo "Running biome lint..."
	@npx biome lint .

.PHONY: format
format: install
	@echo "Running biome formatter..."
	@npx biome check --linter-enabled=false --write .

.PHONY: format-check
format-check: install
	@echo "Running biome formatter check..."
	@npx biome check --linter-enabled=false .

.PHONY: tc
tc: install
	@echo "\nRunning tsc..."
	@npx tsc --noEmit
	@echo "\n tsc ok"

.PHONY: test
test: install
	@echo "\nRunning vitest..."
	@npm test

# Runs the real models on the local example photos (initial_data/, not in git).
.PHONY: test-integration
test-integration: install
	@VITE_INTEGRATION=1 npx vitest run src/models.integration.test.ts

.PHONY: qa-check
qa-check: install
	@echo "\nRunning biome lint..."
	@npx biome lint .
	@echo "\nRunning biome formatter check..."
	@npx biome check --linter-enabled=false .
	@echo "\nRunning tsc..."
	@npx tsc --noEmit
	@echo "\nRunning vitest..."
	@npm test
	@echo "\nQA check complete"
