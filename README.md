- [x] **Faza 5: Warstwa Prezentacji i REST API**
  - Endpointy REST API dla transakcji finansowych i asynchronicznego importu CSV.
  - Endpointy REST API analityki finansowej, wskaźników KPI i serii danych pod wykresy.
  - Endpointy REST API dla Wirtualnego Pokoju Danych (Virtual Data Room) z logiem pobrań.
  - Kompleksowe testy integracyjne API dla izolacji multi-tenant i uprawnień Sanctum.
- [ ] **Faza 6: Frontend React & Dashboard Finansowy** *(W trakcie)*
  - [x] Konfiguracja SPA React z Tailwind CSS, Lucide Icons, klientem API Axios oraz szkieletem layoutu.
  - [x] Refaktoryzacja wizualna: stylistyka terminala instytucjonalnego Deal Advisory (wysoki kontrast Zinc/Slate, precyzyjne kąty inżynieryjne, statusy bezpieczeństwa).
  - [x] Typografia finansowa oraz liczby tabelaryczne (tabular-nums, font-mono dla kwot, wskaźników i dat).
  - [ ] Pasek kontekstu transakcyjnego Deal Advisory (poufność, wybór waluty raportowania, selektor okresu).
  - [ ] Zwarte tabele i komponenty analityczne w stylu narzędzi Bloomberg / FactSet / Ramp.
  - [ ] Moduł uwierzytelniania i przełącznik kontekstu firmy dla doradcy.
  - [ ] Główny Dashboard ze wskaźnikami KPI i wykresami Recharts (trendy, struktura kosztów, płynność).
  - [ ] Moduł tabeli transakcji finansowych z filtrami i kreatorem dodawania.
  - [ ] Interfejs importu plików CSV z podglądem na żywo i paskiem postępu.
- [ ] **Faza 7: Data Room UI, Raporty PDF i Wdrożenie Końcowe**
  - Interfejs Virtual Data Room (VDR) – przeglądarka dokumentów z kategoryzacją i pobieraniem.
  - Generator podsumowań i raportów zarządczych PDF.
  - Testy E2E, audyt bezpieczeństwa i finalna weryfikacja.

Szczegółowa dokumentacja zrealizowanych zmian znajduje się w katalogu [`changelog/`](changelog/README.md).

---

## 📜 Licencja
Projekt objęty licencją własną dla platformy FinBoard.
