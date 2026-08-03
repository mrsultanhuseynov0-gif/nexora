# Web JSON ↔ Excel sahə uyğunluğu

Əl ilə export/import üçün istinad.

## Products (`data/products.json` → `Products` vərəqi)

| JSON | Excel sütun |
|------|-------------|
| id | id |
| name | name |
| brand | brand |
| category | category |
| price | price |
| oldPrice | oldPrice |
| currency | currency |
| rating | rating |
| reviews | reviews |
| badge | badge |
| inStock | inStock |
| isNew | isNew |
| — | sku (ERP əlavəsi) |
| — | minStock, cost, status |

## Categories

| JSON | Excel |
|------|-------|
| id | id |
| name | name |
| slug | slug |
| count | count |
| icon | icon |

## Brands

| JSON | Excel |
|------|-------|
| id | id |
| name | name |
| logo | logo |
| color | color |
