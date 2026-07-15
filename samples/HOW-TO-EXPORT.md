# Как выгрузить игроков из FM26 и скормить их движку

Коротко: тебе **не нужен** мой `.fmf`-файл. Формат вьюхи у SI — зашифрованный
контейнер (AES внутри `afe`-архива), сгенерировать его «сбоку» нельзя — FM такой
файл отвергнет. Зато мой парсер понимает колонки **по их названиям** и сам говорит,
чего не хватило. Поэтому нужно лишь, чтобы во вьюхе были нужные колонки.

---

## Вариант A (быстрый): готовая вьюха «все атрибуты»

1. Скачай любую community-вьюху со **всеми атрибутами**, например:
   - FM Scout — «Essential FM26 Views» (`fmscout.com`)
   - Passion4FM — «Squad View – Detailed» / «Stats Detailed»
   - Steam Workshop — любая «all attributes / data-packed squad view»
2. Положи `.fmf` в папку вьюх:
   `~/Library/Application Support/Sports Interactive/Football Manager 26/views/`
3. В игре на экране **Squad** или **Player Search / Database** щёлкни **правой кнопкой
   по шапке таблицы** → **Import View** → выбери файл → Load.

Мне не важно, какая именно вьюха — лишь бы в ней были все атрибуты (см. список ниже).
Лишние колонки я просто проигнорирую и перечислю их в отчёте.

## Вариант B (точный): собрать вьюху вручную

Правый клик по шапке таблицы → **Add Column** и добавь колонки в этом порядке.
Это ровно то, что читает движок (заголовки я матчу и по полному имени, и по
3-буквенному коду FM, так что узкие колонки тоже подходят):

**Идентификация:** Name, Age, Nat, Club, Position

**Технические (14):** Corners, Crossing, Dribbling, Finishing, First Touch,
Free Kick Taking, Heading, Long Shots, Long Throws, Marking, Passing,
Penalty Taking, Tackling, Technique

**Ментальные (14):** Aggression, Anticipation, Bravery, Composure, Concentration,
Decisions, Determination, Flair, Leadership, Off The Ball, Positioning, Teamwork,
Vision, Work Rate

**Физические (8):** Acceleration, Agility, Balance, Jumping Reach, Natural Fitness,
Pace, Stamina, Strength

**Вратарские (11, у полевых будет `-`):** Aerial Reach, Command Of Area,
Communication, Eccentricity, Handling, Kicking, One On Ones, Punching (Tendency),
Reflexes, Rushing Out (Tendency), Throwing

Минимум для работы: **Name + Position + ≥20 атрибутов**. Чем больше атрибутов
известно (не `-` и не диапазон вроде `10-14`), тем точнее оценки.

> Точный образец заголовков — в `samples/sample-players.csv`. Можно открыть его
> рядом и сверить названия один в один.

---

## Экспорт данных в файл

В FM26 нет нативного экспорта — ставится community-плагин
**«FM26 Player Export by vinteset»** (BepInEx 6 + `.dll`, качается с FM Scout /
sortitoutsi).

**macOS Apple Silicon:** stock-плагин часто падает на длинных списках (300+ строк).
Используй наш **macOS Compatibility Build**:

https://github.com/DadMych/fm26-player-export-macos

```bash
git clone https://github.com/DadMych/fm26-player-export-macos.git
cd fm26-player-export-macos
export FM26_GAME="/path/to/Football Manager 26"
bash install_macos.sh
```

Полная инструкция на английском — в README репозитория.

1. Открой экран **Squad** или **Player Search / Database**, загрузи свою вьюху.
2. Нажми **F9** (или `Ctrl+P`) и **не трогай мышь** — плагин сам прокрутит весь
   список и заберёт все строки.
3. Файлы (`.csv` и `.html`) появятся в:
   `~/Sports Interactive/Football Manager 26/FM26PlayerExport by vinteset/Exports CSV/`
   (HTML — в `Exports HTML/` рядом)

**Вьюхи:** установи пресеты TFP из репо экспорт-плагина **или собери свою** вьюху с нужными колонками — экспорт берёт только то, что видно в таблице.

Пресеты TFP (`install_macos.sh` копирует сам):

| Файл | Экран |
|------|-------|
| `tfp_fm_squad_v1.fmf` | Squad |
| `tfp_basic_stats.fmf` | Player Search |

Путь: `~/Library/Application Support/Sports Interactive/Football Manager 26/views/`

Своя вьюха: **Add Column** в игре или любой `.fmf` с Name + Position + атрибутами. Минимум ~20 известных колонок без `-`.

В игре: правый клик по шапке → **Import View** → Load.

**Важно про перцентили:** движок считает «лучше N% дивизиона» внутри самого файла.
На 4 игроках это шум — выгружай **целую лигу или базу** (сотни/тысячи строк),
тогда оценки осмысленны.

---

## Как передать файл мне

1. Скопируй `.csv` (или `.html`) в папку `data/` этого проекта, например
   `data/players.csv`.
2. Скажи мне имя файла — я прогоню:

```bash
pnpm score data/players.csv            # топ-25 по силе архетипа
pnpm score data/players.csv "Иванов"   # фильтр по имени
```

Либо просто приложи файл/вставь содержимое в чат — разберу так же.

Движок выведет по каждому игроку: семейство-архетип, сильнейший архетип с бейджем,
лучшую роль FM26, % известных атрибутов и человеческое описание. В шапке — отчёт
импорта: формат, сколько строк, что не распозналось, доля скрытых атрибутов.
