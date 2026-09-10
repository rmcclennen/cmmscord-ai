# Fix unreadable bulk asset imports

## Goal
Prevent spreadsheets and document text from turning blank, formatted, numeric-only, or maintenance rows into tens of thousands of assets.

## Changes
- Detect the real spreadsheet data range and ignore hidden, blank, formatting-only, repeated-header, subtotal, and unusable rows.
- Require asset names to look like equipment descriptions rather than IDs, dates, formulas, or isolated numbers.
- Show the cleaned asset count before import instead of the workbook's raw row count.
- Add a safety stop for suspiciously large imports so users must correct the mapping instead of accidentally creating thousands of records.
- Keep PDF/manual scanning selectable for equipment, components, and parts.

## Validation
- Test spreadsheet parsing with sparse and formatted workbooks.
- Re-test a real PDF manual scan.
- Confirm the app builds successfully.

## Technical details
Filtering will be centralized in the import utilities and applied again before database insertion, so every import path receives the same protection.
