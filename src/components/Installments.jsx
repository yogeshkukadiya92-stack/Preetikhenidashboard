import React from 'react';

export function missingInstallmentDate(form) {
  return form.installments?.some(row => !row.dueDate);
}

export default function Installments({form, setForm}) {
  const rows = form.installments ?? [];
  function resize(count) {
    if (!Number.isInteger(count) || count < 0 || count > 999) return;
    setForm(current => ({ ...current, installments: Array.from({length: count}, (_, i) =>
      current.installments?.[i] ?? {amount: '', dueDate: '', completed: false, paymentMode: ''}) }));
  }
  function update(index, patch) {
    setForm(current => ({ ...current, installments: current.installments.map((row, i) =>
      i === index ? {...row, ...patch} : row) }));
  }
  return <section style={{gridColumn: '1 / -1'}}>
    <label className="field-block">Number of installments
      <input className="lead-input" type="number" min="0" max="999" placeholder="0" value={rows.length || ''} onChange={e => resize(Number(e.target.value))}/>
    </label>
    {rows.length > 0 && <div className="installment-table-scroll">
      <table className="installment-table">
        <thead><tr><th scope="col">#</th><th scope="col">Installment amount</th><th scope="col">Installment date</th><th scope="col">Cash / GPay</th><th scope="col">Completed</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={index}>
          <th scope="row">{index + 1}</th>
          <td><input aria-label={`Installment ${index + 1} amount`} className="lead-input" type="number" min="0" step="0.01" value={row.amount ?? ''} onChange={e => update(index, {amount: e.target.value})}/></td>
          <td><input aria-label={`Installment ${index + 1} date`} className="lead-input" required type="date" value={row.dueDate ?? ''} onChange={e => update(index, {dueDate: e.target.value})}/></td>
          <td><select aria-label={`Installment ${index + 1} payment mode`} className="lead-input" value={row.paymentMode ?? ''} onChange={e => update(index, {paymentMode: e.target.value})}><option value="">Select</option><option>Cash</option><option>GPay</option></select></td>
          <td><input aria-label={`Installment ${index + 1} completed`} type="checkbox" checked={Boolean(row.completed)} onChange={e => update(index, {completed: e.target.checked})}/></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {missingInstallmentDate(form) && <small>Enter a due date for each installment to save.</small>}
  </section>;
}
