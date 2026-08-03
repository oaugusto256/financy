# Slice 1 — Figma handoff checklist

The agent that built this slice has no Figma access, so every visual comparison
below is for the repository owner. Run `npm run dev:frontend` and compare each
item against the Pages tab. Report differences; they are corrected before the
pull request is opened.

## New this slice

### Login (`/`, signed out)

- [ ] Card width and padding.
- [ ] Spacing between the e-mail, password and "Lembrar-me" fields.
- [ ] The "ou" divider — rule weight, color, gap around the word.
- [ ] **"Criar conta" treatment.** The design draws it as a secondary button.
      It is built as a `TextLink` styled to match, so it stays a real link:
      right-clickable, middle-clickable, and announced as navigation rather
      than as an action. Confirm this, or reject it and it becomes a `Button`
      wrapping a `Link`, with the decision recorded in `frontend.md` section 12.
- [ ] No password recovery link. Deliberate — `frontend.md` section 12 records
      why, and a test enforces it. Flagged here because the link is in the
      Figma frame.

### Sign up (`/signup`)

- [ ] The same four items as login.
- [ ] Position of the password helper text, "A senha deve ter no mínimo 8
      caracteres". It is visible before the user types, not only after a
      failure.
- [ ] There is no "Lembrar-me" on this form; the design does not draw one.
      Confirm.

### Profile (`/profile`)

- [ ] Avatar size.
- [ ] The disabled e-mail field's fill and text color.
- [ ] The "Sair da conta" button — danger color on the icon and label.
- [ ] The loading skeleton, visible before `me` resolves.

### Checkbox (`/style-guide`)

- [ ] Box size, border radius, checked fill color, focus ring. It is a native
      `<input type="checkbox">` colored with `accent-color`, not a custom box.

### Top bar

- [ ] The top bar with a real name in it, against the signed-in frames. Sign in
      and compare; earlier slices only ever showed a placeholder name.

## Carried forward from slice 0, still open

Both moved to [`slice-2-figma-handoff.md`](./slice-2-figma-handoff.md), which
is where they are now blocking work.

## Manual walkthrough

Not automatable from here — the storage assertions below use a real browser's
tab lifecycle, which the jsdom equivalents in the test suite do not exercise.
Run `npm run dev:backend` and `npm run dev:frontend`, then:

1. [ ] At `http://localhost:5173/`, the login screen renders with no top bar.
2. [ ] Create an account at `/signup`; land on the dashboard placeholder with
       the top bar and the avatar showing the right initials.
3. [ ] Reload. The session survives.
4. [ ] Go to `/profile`, change the name, save. The top bar updates.
5. [ ] Sign out. The login screen returns, and neither `localStorage` nor
       `sessionStorage` holds a `financy.token` (check in the console).
6. [ ] Sign in with "Lembrar-me" **unchecked**, close the tab, reopen
       `http://localhost:5173/`. The login screen is shown, not the dashboard.
7. [ ] Sign in with "Lembrar-me" **checked** and repeat: the dashboard is shown.
8. [ ] With no session, navigate directly to `/transactions`. It redirects to
       the login screen.

Step 6 is the one that fails silently if `writeToken` does not clear both
stores. A test covers it, but that test uses a jsdom storage with no tab
lifecycle behind it.
