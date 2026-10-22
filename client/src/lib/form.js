/**
 * Form controls in this app use two different onChange conventions:
 *   - Input / Select / Textarea pass the raw DOM event
 *   - Checkbox / Toggle / SearchInput pass the plain value
 *
 * `fieldValue` accepts either and returns the plain value, so a single
 * `update(key)` handler can be attached to any control.
 */
export function fieldValue(input) {
  if (input && typeof input === 'object' && input.target) {
    const { type, value, checked } = input.target;
    return type === 'checkbox' ? checked : value;
  }
  return input;
}

export default fieldValue;
