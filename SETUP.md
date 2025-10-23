# Ronin NFT Bridge - Automated Setup

Этот Makefile автоматизирует установку всех зависимостей для проекта ronin-nft-bridge, включая Rust, Solana CLI и Anchor CLI.

## 🚀 Быстрый старт

### Первая установка на новом сервере:
```bash
make quick-setup
```

### Обычная установка:
```bash
make install-all
```

### Проверка установки:
```bash
make check-versions
```

### Запуск тестов:
```bash
make test-all
```

### Диагностика проблем:
```bash
make troubleshoot
```

## 📋 Доступные команды

| Команда | Описание |
|---------|----------|
| `make install-all` | Установить все зависимости (Rust, Solana, Anchor) |
| `make clean-install` | Полная переустановка с очисткой |
| `make install-rust` | Установить только Rust |
| `make install-solana` | Установить только Solana CLI |
| `make install-anchor` | Установить только Anchor CLI |
| `make install-deps` | Установить зависимости проекта (pnpm) |
| `make test-evm` | Запустить EVM тесты (Foundry) |
| `make test-solana` | Запустить Solana тесты (Bankrun) |
| `make test-all` | Запустить все тесты |
| `make check-versions` | Проверить установленные версии |
| `make clean` | Очистить артефакты сборки |
| `make troubleshoot` | Диагностическая информация |
| `make help` | Показать все команды |

## 🔧 Что устанавливается

### Rust
- **Версия**: `nightly` (для поддержки `edition2024`)
- **Путь**: `~/.cargo/bin/`
- **Автоматически**: устанавливается через rustup

### Solana CLI
- **Версия**: `v1.18.26`
- **Архитектура**: автоматически определяется (Linux/macOS)
- **Путь**: `~/solana-release/bin/`
- **Автоматически**: добавляется в PATH

### Anchor CLI
- **Версия**: `v0.29.0`
- **Путь**: `~/.cargo/bin/anchor`
- **Совместимость**: создается обертка `cargo-build-bpf`

### Зависимости проекта
- **pnpm**: версия `10.15.0`
- **Node.js**: рекомендуется версия `18+`
- **Foundry**: зависимости OpenZeppelin и других библиотек

## 🛠️ Решение проблем

### Проблема: "command not found"
```bash
# Перезагрузите shell или выполните:
source ~/.bashrc
# или
source ~/.zshrc
```

### Проблема: "Permission denied"
```bash
# Убедитесь, что у вас есть права на запись в домашнюю директорию
ls -la ~/
```

### Проблема: "Rust compilation failed"
```bash
# Попробуйте полную переустановку:
make clean-install
```

### Проблема: "Anchor build failed"
```bash
# Проверьте совместимость версий:
make check-versions
make troubleshoot
```

## 🔍 Диагностика

### Проверка версий:
```bash
make check-versions
```

### Диагностическая информация:
```bash
make troubleshoot
```

### Очистка и переустановка:
```bash
make clean-install
```

## 📁 Структура установки

```
~/
├── .cargo/
│   ├── bin/
│   │   ├── rustc
│   │   ├── cargo
│   │   └── anchor
│   └── env
├── solana-release/
│   └── bin/
│       ├── solana
│       └── cargo-build-sbf
└── .local/
    └── bin/
        └── cargo-build-bpf  # Обертка для совместимости
```

## 🌍 Поддерживаемые ОС

- ✅ **macOS** (Apple Silicon и Intel)
- ✅ **Linux** (x86_64)
- ⚠️ **Windows** (требует WSL или Git Bash)

## 📝 Логи и отладка

Makefile выводит цветные сообщения:
- 🔵 **Синий**: Информационные сообщения
- 🟡 **Желтый**: Предупреждения
- 🟢 **Зеленый**: Успешные операции
- 🔴 **Красный**: Ошибки

## 🔄 Обновление

Для обновления до новых версий:
```bash
make clean-install
```

## 📞 Поддержка

Если возникают проблемы:
1. Запустите `make troubleshoot`
2. Проверьте `make check-versions`
3. Попробуйте `make clean-install`

## 🎯 Примеры использования

### Установка на новом сервере:
```bash
git clone <repository>
cd ronin-nft-bridge
make quick-setup
make test-all
```

### Разработка:
```bash
make test-evm      # Только EVM тесты
make test-solana   # Только Solana тесты
make clean         # Очистка артефактов
```

### Отладка:
```bash
make troubleshoot  # Диагностическая информация
make check-versions # Проверить версии
make help          # Показать все команды
```
