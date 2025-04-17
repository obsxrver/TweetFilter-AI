// Custom Select Dropdown Module
const CustomSelect = {
    /**
     * Creates a custom select dropdown with search functionality.
     * @param {HTMLElement} container - Container to append the custom select to.
     * @param {string} id - ID for the root custom-select div.
     * @param {Array<{value: string, label: string}>} options - Options for the dropdown.
     * @param {string} initialSelectedValue - Initially selected value.
     * @param {Function} onChange - Callback function when selection changes.
     * @param {string} searchPlaceholder - Placeholder text for the search input.
     */
    create(container, id, options, initialSelectedValue, onChange, searchPlaceholder) {
        let currentSelectedValue = initialSelectedValue;

        const customSelect = document.createElement('div');
        customSelect.className = 'custom-select';
        customSelect.id = id;

        const selectSelected = document.createElement('div');
        selectSelected.className = 'select-selected';

        const selectItems = document.createElement('div');
        selectItems.className = 'select-items';
        selectItems.style.display = 'none'; // Initially hidden

        const searchField = document.createElement('div');
        searchField.className = 'search-field';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input';
        searchInput.placeholder = searchPlaceholder || 'Search...';
        searchField.appendChild(searchInput);
        selectItems.appendChild(searchField);

        // Function to render options
        const renderOptions = (filter = '') => {
            // Clear previous options (excluding search field)
            while (selectItems.childNodes.length > 1) {
                selectItems.removeChild(selectItems.lastChild);
            }

            const filteredOptions = options.filter(opt =>
                opt.label.toLowerCase().includes(filter.toLowerCase())
            );

            if (filteredOptions.length === 0) {
                const noResults = document.createElement('div');
                noResults.textContent = 'No matches found';
                noResults.style.cssText = 'opacity: 0.7; font-style: italic; padding: 10px; text-align: center; cursor: default;';
                selectItems.appendChild(noResults);
            }

            filteredOptions.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.textContent = option.label;
                optionDiv.dataset.value = option.value;
                if (option.value === currentSelectedValue) {
                    optionDiv.classList.add('same-as-selected');
                }

                optionDiv.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent closing immediately
                    currentSelectedValue = option.value;
                    selectSelected.textContent = option.label;
                    selectItems.style.display = 'none';
                    selectSelected.classList.remove('select-arrow-active');

                    // Update classes for all items
                    selectItems.querySelectorAll('div[data-value]').forEach(div => {
                        div.classList.toggle('same-as-selected', div.dataset.value === currentSelectedValue);
                    });

                    onChange(currentSelectedValue);
                });
                selectItems.appendChild(optionDiv);
            });
        };

        // Set initial display text
        const initialOption = options.find(opt => opt.value === currentSelectedValue);
        selectSelected.textContent = initialOption ? initialOption.label : 'Select an option';

        customSelect.appendChild(selectSelected);
        customSelect.appendChild(selectItems);
        container.appendChild(customSelect);

        // Initial rendering
        renderOptions();

        // Event listeners
        searchInput.addEventListener('input', () => renderOptions(searchInput.value));
        searchInput.addEventListener('click', e => e.stopPropagation()); // Prevent closing

        selectSelected.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeAll(customSelect); // Close others
            const isHidden = selectItems.style.display === 'none';
            selectItems.style.display = isHidden ? 'block' : 'none';
            selectSelected.classList.toggle('select-arrow-active', isHidden);
            if (isHidden) {
                searchInput.focus();
                searchInput.select(); // Select text for easy replacement
                renderOptions(); // Re-render in case options changed
            }
        });
    },

    /**
     * Closes all custom select dropdowns except the one passed in.
     * @param {HTMLElement} exceptThisOne - The select dropdown to keep open.
     */
    closeAll(exceptThisOne = null) {
        document.querySelectorAll('.custom-select').forEach(select => {
            if (select === exceptThisOne) return;
            const items = select.querySelector('.select-items');
            const selected = select.querySelector('.select-selected');
            if (items) items.style.display = 'none';
            if (selected) selected.classList.remove('select-arrow-active');
        });
    }
}; 