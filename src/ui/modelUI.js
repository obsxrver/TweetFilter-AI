// Model UI Management Module
const ModelUI = {
    /**
     * Formats a model object into a string for display in dropdowns.
     * @param {Object} model - The model object from the API.
     * @returns {string} A formatted label string.
     */
    formatModelLabel(model) {
        let label = model.slug || model.id || model.name || 'Unknown Model';
        let pricingInfo = '';

        // Extract pricing
        const pricing = model.endpoint?.pricing || model.pricing;
        if (pricing) {
            const promptPrice = parseFloat(pricing.prompt);
            const completionPrice = parseFloat(pricing.completion);

            if (!isNaN(promptPrice)) {
                pricingInfo += ` - $${(promptPrice*1e6).toFixed(4)}/mil. tok.-in`;
                if (!isNaN(completionPrice) && completionPrice !== promptPrice) {
                    pricingInfo += ` $${(completionPrice*1e6).toFixed(4)}/mil. tok.-out`;
                }
            } else if (!isNaN(completionPrice)) {
                pricingInfo += ` - $${(completionPrice*1e6).toFixed(4)}/mil. tok.-out`;
            }
        }

        // Add vision icon
        const isVision = model.input_modalities?.includes('image') ||
                        model.architecture?.input_modalities?.includes('image') ||
                        model.architecture?.modality?.includes('image');
        if (isVision) {
            label = '🖼️ ' + label;
        }

        return label + pricingInfo;
    },

    /**
     * Updates the model selection dropdowns based on availableModels.
     */
    refreshModelsUI() {
        const modelSelectContainer = document.getElementById('model-select-container');
        const imageModelSelectContainer = document.getElementById('image-model-select-container');

        // Filter and sort models
        listedModels = [...availableModels];
        
        // Filter free models if needed
        if (!showFreeModels) {
            listedModels = listedModels.filter(model => !model.slug.endsWith(':free'));
        }

        // Sort models based on current sort order and direction
        const sortDirection = browserGet('sortDirection', 'default');
        const sortOrder = browserGet('modelSortOrder', 'throughput-high-to-low');
        
        // Update toggle button text based on sort order
        const toggleBtn = document.getElementById('sort-direction');
        if (toggleBtn) {
            switch(sortOrder) {
                case 'latency-low-to-high':
                    toggleBtn.textContent = sortDirection === 'default' ? 'High-Low' : 'Low-High';
                    if (sortDirection === 'reverse') listedModels.reverse();
                    break;
                case '': // Age
                    toggleBtn.textContent = sortDirection === 'default' ? 'New-Old' : 'Old-New';
                    if (sortDirection === 'reverse') listedModels.reverse();
                    break;
                case 'top-weekly':
                    toggleBtn.textContent = sortDirection === 'default' ? 'Most Popular' : 'Least Popular';
                    if (sortDirection === 'reverse') listedModels.reverse();
                    break;
                default:
                    toggleBtn.textContent = sortDirection === 'default' ? 'High-Low' : 'Low-High';
                    if (sortDirection === 'reverse') listedModels.reverse();
            }
        }

        // Update main model selector
        if (modelSelectContainer) {
            modelSelectContainer.innerHTML = '';
            CustomSelect.create(
                modelSelectContainer,
                'model-selector',
                listedModels.map(model => ({ value: model.slug || model.id, label: this.formatModelLabel(model) })),
                selectedModel,
                (newValue) => {
                    selectedModel = newValue;
                    browserSet('selectedModel', selectedModel);
                    UIUtils.showStatus('Rating model updated');
                },
                'Search rating models...'
            );
        }

        // Update image model selector
        if (imageModelSelectContainer) {
            const visionModels = listedModels.filter(model =>
                model.input_modalities?.includes('image') ||
                model.architecture?.input_modalities?.includes('image') ||
                model.architecture?.modality?.includes('image')
            );

            imageModelSelectContainer.innerHTML = '';
            CustomSelect.create(
                imageModelSelectContainer,
                'image-model-selector',
                visionModels.map(model => ({ value: model.slug || model.id, label: this.formatModelLabel(model) })),
                selectedImageModel,
                (newValue) => {
                    selectedImageModel = newValue;
                    browserSet('selectedImageModel', selectedImageModel);
                    UIUtils.showStatus('Image model updated');
                },
                'Search vision models...'
            );
        }
    }
}; 