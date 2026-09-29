# FinBoard Architecture: SPA Routing, URL-Friendly Navigation & Access Control

**Wersja:** 1.0  
**Kontekst:** Architektura Frontendu Platformy FinBoard (React 19 + React Router v7 + Tailwind CSS)

---

## 1. Wprowadzenie i Cel Architektoniczny

W pierwotnej architekturze platformy FinBoard interfejs użytkownika opierał się na monolitycznym zarządzaniu stanem widoków (`currentRoute` jako lokalny ciąg znaków w stanie `App.jsx`). Powodowało to krytyczną anomalię architektoniczną: **zamrożony adres URL (`http://localhost:8080/login`)**, który pozostawał w pasku przeglądarki niezależnie od tego, po jakim module platformy poruszał się zalogowany doradca czy analityk (np. Dashboard, Analityka P&L, Wirtualny Pokój Danych czy Księga Operacji).

Zjawisko to uniemożliwiało:
1. **Głębokie linkowanie (Deep Linking):** Brak możliwości przesłania bezpośredniego adresu URL do dokumentu w VDR, konkretnego raportu czy widoku modelowania inwestycyjnego.
2. **Historię przeglądarki:** Przyciski „Wstecz” i „Dalej” w przeglądarce powodowały opuszczenie aplikacji zamiast powrotu do poprzedniego ekranu.
3. **Prawidłowe odświeżanie strony (F5):** Przeładowanie powodowało utratę kontekstu nawigacyjnego.
4. **Instytucjonalny poziom UX i bezpieczeństwa:** Standardy transakcyjne Deal Advisory wymagają jednoznacznej identyfikacji zasobów (URI) oraz bezkompromisowej ochrony uprawnień (RBAC).

W ramach Faz 57–59 przeprowadzono kompleksową transformację architektury frontendowej na nowoczesny routing SPA w oparciu o bibliotekę `react-router-dom` v7, wprowadzając hierarchiczne gniazda `<Outlet />`, strażników tras (Route Guards), semantyczną nawigację `<NavLink>` oraz dedykowany ekran błędu 404 w stylistyce dark terminal.

---

## 2. Stos Technologiczny i Biblioteki

- **React:** 19.0.0
- **Routing Engine:** `react-router-dom` v7.18.4 (`<BrowserRouter>`, `<MemoryRouter>`, `<Routes>`, `<Route>`, `<Outlet>`, `<NavLink>`, `useNavigate`, `useLocation`, `useParams`, `useSearchParams`, `useInRouterContext`)
- **Styling:** Tailwind CSS (Dark Institutional Theme)
- **Ikony:** Lucide Icons
- **Środowisko Testowe:** Vitest + Happy-DOM + React Testing Library (`@testing-library/react`)

---

## 3. Centralny Rejestr Tras i Tytułów (`routes.js`)

Wszystkie ścieżki i tytuły widoków w aplikacji są scentralizowane w pliku [`resources/js/constants/routes.js`](file:///home/rafal/Workspace/finboard/resources/js/constants/routes.js). Wyklucza to stosowanie ciągów znaków (magic strings) w komponentach i testach.

```javascript
export const ROUTES = {
    LOGIN: '/login',
    ACCEPT_INVITATION: '/accept-invitation',
    ACCEPT_INVITATION_TOKEN: '/accept-invitation/:token',
    INVITATION_ACCEPT: '/invitation/accept',
    DASHBOARD: '/dashboard',
    ANALYTICS: '/analytics',
    RECORDS: '/records',
    IMPORT: '/import',
    VDR: '/vdr',
    REPORTS: '/reports',
    AUDIT_LOGS: '/audit-logs',
    ADVISORS: '/advisors',
    INVESTMENT_PLANNING: '/investment-planning',
    NOT_FOUND: '/404',
};

export const ROUTE_TITLES = {
    [ROUTES.LOGIN]: 'Logowanie',
    [ROUTES.ACCEPT_INVITATION]: 'Aktywacja Konta',
    [ROUTES.DASHBOARD]: 'Pulpit Zarządczy',
    [ROUTES.ANALYTICS]: 'Analityka P&L i Płynności',
    [ROUTES.RECORDS]: 'Księga Główna Transakcji',
    [ROUTES.IMPORT]: 'Import Danych Finansowych',
    [ROUTES.VDR]: 'Wirtualny Pokój Danych (VDR)',
    [ROUTES.REPORTS]: 'Raporty Wykonawcze PDF',
    [ROUTES.AUDIT_LOGS]: 'Dziennik Zdarzeń Audytowych',
    [ROUTES.ADVISORS]: 'Doradcy & Przypisania Spółek',
    [ROUTES.INVESTMENT_PLANNING]: 'Planowanie Inwestycyjne & Model 15L',
    [ROUTES.NOT_FOUND]: '404 - Nie Znaleziono Trasy',
};
```

---

## 4. Architektura Strażników Tras (Route Guards)

Dostęp do poszczególnych ścieżek URL jest zabezpieczony na poziomie komponentów strażników w katalogu [`resources/js/components/routing/`](file:///home/rafal/Workspace/finboard/resources/js/components/routing/).

```
                 [Żądanie URL]
                       │
             Czy trasa chroniona?
            ┌──────────┴──────────┐
           NIE                   TAK
            │                     │
      [GuestRoute]         [ProtectedRoute]
     Czy zalogowany?       Czy zalogowany?
      ┌─────┴─────┐         ┌─────┴─────┐
     TAK         NIE       TAK         NIE
      │           │         │           │
Przekieruj     Renderuj     │      Przekieruj na /login
do /dashboard  (LoginView)  │      ze state.from = URL
                            │
                      Wymaga roli RBAC?
                     ┌──────┴──────┐
                    TAK           NIE
                     │             │
                [RoleGuard]    Renderuj
               Czy rola OK?     (Outlet)
                ┌────┴────┐
               TAK       NIE
                │         │
             Renderuj  Wyświetl warning
             (Outlet)  i przekieruj do /dashboard
```

### 4.1. ProtectedRoute (`ProtectedRoute.jsx`)
- Weryfikuje stan `isAuthenticated` oraz `loading` z `AuthContext`.
- Jeśli sesja jest w trakcie weryfikacji (`loading: true`), renderuje instytucjonalny spinner ładowania w ciemnym motywie.
- Jeśli użytkownik nie jest zalogowany, wykonuje natychmiastowe przekierowanie:
  ```jsx
  <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
  ```
- Zapamiętanie obiektu `location` w `state.from` umożliwia późniejsze odesłanie użytkownika dokładnie na stronę, którą próbował odwiedzić.
- Wspiera zarówno gniazdo `<Outlet />`, jak i przekazany `children`.

### 4.2. GuestRoute (`GuestRoute.jsx`)
- Zabezpiecza ekrany publiczne (np. `/login`, `/accept-invitation`) przed dostępem zalogowanych użytkowników.
- Zalogowany użytkownik próbujący odwiedzić `/login` jest natychmiast przekierowywany na adres z `location.state?.from?.pathname` lub domyślnie na `/dashboard`.

### 4.3. RoleGuard (`RoleGuard.jsx`)
- Implementuje kontrolę dostępu opartą o role (Role-Based Access Control - RBAC).
- Przyjmuje tablicę uprawnionych ról: `allowedRoles={['super_admin', 'admin', 'advisor']}`.
- W przypadku braku uprawnień (np. użytkownik z rolą `client` próbujący otworzyć moduł `/advisors`):
  1. Wywołuje ostrzeżenie w systemie powiadomień: `notification.warning('Brak uprawnień do przeglądania tego zasobu...')`.
  2. Przekierowuje użytkownika bezpiecznie na `/dashboard` z flagą `replace`.

---

## 5. Powłoka Aplikacji i Semantyczna Nawigacja (`<Outlet />` & `<NavLink>`)

### 5.1. Układ Aplikacji z Gniazdem (`AppLayout.jsx`)
Komponent `AppLayout` stanowi szkielet aplikacji (Sidebar + Header + Main Area). Został przekształcony ze sztywnego kontenera warunkowego w samowystarczalną powłokę gniazdową:

```jsx
<main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
        {children ? children : <Outlet context={{ onRefreshData, refreshing, refreshKey }} />}
    </div>
</main>
```

Podrzędne widoki domenowe odczytują parametry odświeżania z kontekstu gniazda za pomocą hooka `useOutletContext()`:
```javascript
const { onRefreshData, refreshing, refreshKey } = useOutletContext() || {};
```

### 5.2. Dynamiczna Rezolucja Tytułów (`Header.jsx`)
Komponent `Header` nie wymaga już manualnego przekazywania nagłówka przez prop. Samodzielnie subskrybuje zmiany lokalizacji za pomocą `useLocation()` i rozwiązuje tytuł według hierarchii:
1. Bezpośrednie dopasowanie w słowniku `ROUTE_TITLES[location.pathname]`.
2. Dopasowanie dla ścieżek głównych (`/` -> `ROUTE_TITLES[ROUTES.DASHBOARD]`).
3. Jawnie przekazany prop `title` (kompatybilność wsteczna).
4. Domyślny fallback: `'FinBoard'`.

### 5.3. Nawigacja Semantyczna (`Sidebar.jsx`)
Przyciski `<button>` w bocznym menu zostały zastąpione semantycznymi linkami `<NavLink to={item.path}>`:
- Płynna aktywacja stylów: aktywny moduł wyróżniany jest klasami `bg-zinc-850`, `border-l-2`, `border-zinc-100` oraz jasną ikoną i kodem badge'a.
- Kontrola uprawnień RBAC: moduł „Doradcy & Przypisania” (`/advisors`) jest dynamicznie ukrywany przed użytkownikami o roli `client`.
- Izolacja testowa: Komponent wykorzystuje `useInRouterContext()` – w przypadku renderowania w testach jednostkowych bez dostawcy routera następuje bezpieczny fallback do standardowych elementów `<button>`.

---

## 6. Obsługa Błędów i Dedykowany Ekran 404 (`NotFoundView.jsx`)

Nieprawidłowe, wygasłe lub błędnie wpisane ścieżki URL są przechwytywane przez regułę wildcard w routerze:

```jsx
<Route path={ROUTES.NOT_FOUND} element={<NotFoundView />} />
<Route path="*" element={<NotFoundView />} />
```

Komponent `NotFoundView` został zaprojektowany w instytucjonalnej estetyce Dark Terminal:
- **Diagnostyka URI:** Wyświetla żądany błędny adres URL w komponencie oznaczonym `data-testid="404-requested-path"`.
- **Wskaźnik Sesji:** Prezentuje aktualny stan uwierzytelnienia (aktywny analityk vs sesja publiczna).
- **Symulacja CLI Routera:** Prezentuje kod błędu HTTP `404_ERR_ROUTE_UNDEFINED` i timestamp zdarzenia w notacji ISO.
- **Akcje Nawigacyjne:** Przyciski powrotu do Pulpitu / Ekranu Logowania oraz funkcja `navigate(-1)` cofająca użytkownika w historii przeglądarki.

---

## 7. Środowisko i Narzędzia Testowe

W celu zapewnienia 100% stabilności i wyeliminowania ryzyka regresji wdrożono dedykowane środowisko testowe w Vitest:

### 7.1. Pomocnik Testowy `renderWithRouter` (`tests/utils/renderWithRouter.jsx`)
Uniwersalne narzędzie zastępujące standardowy `render()` z `@testing-library/react` dla komponentów zależnych od routingu:
- Opakowuje drzewo w `MemoryRouter` z możliwością zdefiniowania `initialEntries` oraz `initialIndex`.
- Automatycznie dostarcza mocki `AuthContext` (z pełną kontrolą nad rolami, użytkownikiem i stanem sesji) oraz `NotificationContext`.

### 7.2. Struktura Pokrycia Testowego
1. **Testy jednostkowe strażników ([`RouteGuards.test.jsx`](file:///home/rafal/Workspace/finboard/resources/js/tests/components/RouteGuards.test.jsx) - 12 testów):**
   - Testy stanów ładowania, przekierowań niezalogowanych, zapamiętywania `state.from`.
   - Testy ochrony tras gościa i przekierowań zalogowanych.
   - Testy autoryzacji ról `super_admin`, `admin`, `advisor` oraz blokowania roli `client` z notyfikacją.
2. **Testy jednostkowe paska bocznego ([`Sidebar.test.jsx`](file:///home/rafal/Workspace/finboard/resources/js/tests/components/Sidebar.test.jsx) - 8 testów):**
   - Weryfikacja renderowania 8 linków bazowych z atrybutami `href`.
   - Dynamiczna aplikacja klas CSS dla aktywnej trasy.
   - Filtrowanie pozycji menu wg ról RBAC.
   - Obsługa wylogowania i odporność na brak routera w kontekście.
3. **Testy integracyjne E2E SPA ([`spaRoutingNavigationWorkflow.test.jsx`](file:///home/rafal/Workspace/finboard/resources/js/tests/integration/spaRoutingNavigationWorkflow.test.jsx) - 6 testów):**
   - Pełny cykl życia: od niezalogowanego wejścia na `/dashboard`, przez przekierowanie na `/login`, uwierzytelnienie z powrotem na `/records`, nawigację Sidebar, blokadę RBAC `/advisors`, obsługę 404, aż po wylogowanie z usunięciem tokena sesji.

---

## 8. Wskazówki Rozwojowe (Developer Guidelines)

### Jak dodać nową trasę do aplikacji?
1. Zdefiniuj stałą w `resources/js/constants/routes.js`:
   ```javascript
   export const ROUTES = {
       // ...
       NEW_FEATURE: '/new-feature',
   };
   export const ROUTE_TITLES = {
       // ...
       [ROUTES.NEW_FEATURE]: 'Nowy Moduł Analityczny',
   };
   ```
2. Zarejestruj trasę w drzewie `<Routes>` w `resources/js/App.jsx`:
   - Jeśli to trasa chroniona ogólna: dodaj `<Route path={ROUTES.NEW_FEATURE} element={<NewFeatureView />} />` wewnątrz powłoki `ProtectedLayout`.
   - Jeśli to trasa z ograniczeniem ról: opakuj w `<Route element={<RoleGuard allowedRoles={['admin', 'advisor']} />}>`.
3. Dodaj wpis w menu `Sidebar.jsx`:
   ```javascript
   { id: 'new_feature', path: ROUTES.NEW_FEATURE, label: 'Nowy Moduł', icon: Layers, code: 'MOD-09' }
   ```
4. Utwórz testy wykorzystując helper `renderWithRouter`:
   ```javascript
   import { renderWithRouter } from '@/tests/utils';
   renderWithRouter(<NewFeatureView />, { initialEntries: [ROUTES.NEW_FEATURE] });
   ```
