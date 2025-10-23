# 🚀 Ronin NFT Bridge - Quick Setup

## Автоматическая установка всех зависимостей

### Быстрая установка (рекомендуется)
```bash
# Первая установка
make quick-setup

# Или пошагово
make install-all
make test-all
```

### Ручная установка
```bash
# 1. Rust
curl https://sh.rustup.rs -sSf | sh -s -- -y
source ~/.cargo/env
rustup toolchain install nightly
rustup default nightly

# 2. Solana CLI
cd ~
curl -sSfL https://github.com/solana-labs/solana/releases/download/v1.18.26/solana-release-aarch64-apple-darwin.tar.bz2 -o solana-release.tar.bz2
tar -xjf solana-release.tar.bz2
echo 'export PATH="$HOME/solana-release/bin:$PATH"' >> ~/.bashrc

# 3. Anchor CLI
mkdir -p ~/.local/bin
echo '#!/usr/bin/env bash' > ~/.local/bin/cargo-build-bpf
echo 'exec "$HOME/solana-release/bin/cargo-build-sbf" "$@"' >> ~/.local/bin/cargo-build-bpf
chmod +x ~/.local/bin/cargo-build-bpf
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.cargo/env
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.29.0 --force

# 4. Зависимости проекта
pnpm install
```

## 📋 Доступные команды

| Команда | Описание |
|---------|----------|
| `make install-all` | Установить все зависимости |
| `make clean-install` | Полная переустановка |
| `make test-all` | Запустить все тесты |
| `make check-versions` | Проверить версии |
| `make troubleshoot` | Диагностика проблем |
| `make help` | Показать все команды |

## 🔧 Что устанавливается

- **Rust**: nightly (для поддержки edition2024)
- **Solana CLI**: v1.18.26
- **Anchor CLI**: v0.29.0
- **Зависимости**: pnpm, Foundry библиотеки

## 🛠️ Решение проблем

```bash
# Проверка установки
make check-versions

# Диагностика проблем
make troubleshoot

# Полная переустановка
make clean-install

# Показать все команды
make help
```

## 📖 Подробная документация

См. [SETUP.md](SETUP.md) для полной документации.

---

**Быстрый старт:**
```bash
make quick-setup && make test-all
```
