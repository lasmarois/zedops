# Goal #16: Mobile-Friendly UI/UX — Findings

## Browser Testing Results (390x844, iPhone 14)

### Critical Issues
1. ServerDetail action buttons pushed off-screen → entire page scrolls horizontally
2. ServerDetail header overflow (all items in single flex row)
3. Users table columns cut off (Created, Actions hidden)
4. Users "+ Invite User" button clipped
5. Audit Logs target column and chevron hidden

### Major Issues
6. Dashboard Recent Activity rows overflow
7. ServerDetail tabs clipped (Performance, Backups hidden)
8. AgentDetail last seen date clipped
9. AgentDetail storage table "%" column barely visible
10. ServerList/AgentList header cramped
11. AgentDetail Servers tab Create button clipped

### Minor Issues
12. p-8 (32px) wastes space on 390px
13. text-3xl headers too large for mobile
14. Tabs lack scroll indicator

### Already Working Well
- Hamburger sidebar
- Dashboard stat cards (1-column grid)
- Agent cards (1-column grid)
- Server cards in compact mode
- Settings page theme grid
- Login/Register pages
- RCON tab
- Server Overview tab content

## Technical Notes
- DropdownMenu component already exists in ui/dropdown-menu.tsx
- MoreVertical icon available from lucide-react (already used in AgentServerList)
- Tailwind `md:` breakpoint = 768px (good for mobile vs desktop split)
- `sm:` breakpoint = 640px (used for intermediate layouts)
