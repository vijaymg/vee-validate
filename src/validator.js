import Rules from './rules';
import ErrorBag from './errorBag';
import ValidatorException from './exceptions/validatorException';
import Messages from './messages';

export default class Validator
{
    constructor(validations) {
        this.locale = 'en';
        this.validations = this.normalize(validations);
        this.errorBag = new ErrorBag();
    }

    /**
     * Sets the validator current langauge.
     *
     * @param {string} language locale or language id.
     */
    setLocale(language) {
        this.locale = language;
    }

    /**
     * Registers a field to be validated.
     *
     * @param  {string} name The field name.
     * @param  {string} checks validations expression.
     */
    attach(name, checks) {
        this.validations[name] = [];
        this.errorBag.remove(name);

        checks.split('|').forEach(rule => {
            this.validations[name].push(this.normalizeRule(rule));
        });
    }

    /**
     * Updates the messages dicitionary, overwriting existing values and adding new ones.
     *
     * @param  {object} messages The messages object.
=     */
    static updateDictionary(messages) {
        Object.keys(messages).forEach(locale => {
            if (! Messages[locale]) {
                Messages[locale] = {};
            }

            Object.keys(messages[locale]).forEach(name => {
                Messages[locale][name] = messages[locale][name];
            });
        });
    }

    /**
     * Static constructor.
     *
     * @param  {object} validations The validations object.
     * @return {Validator} validator A validator object.
     */
    static create(validations) {
        return new Validator(validations);
    }

    /**
     * Adds a custom validator to the list of validation rules.
     *
     * @param  {string} name The name of the validator.
     * @param  {object|function} validator The validator object/function.
     */
    static extend(name, validator) {
        Validator.guardExtend(name, validator);

        Validator.merge(name, validator);
    }

    /**
     * Merges a validator object into the Rules and Messages.
     *
     * @param  {string} name The name of the validator.
     * @param  {function|object} validator The validator object.
     */
    static merge(name, validator) {
        if (typeof validator === 'function') {
            Rules[name] = validator;
            Messages.en[name] = (field) => `The ${field} value is not valid.`;
            return;
        }

        Rules[name] = validator.validate;

        if (validator.getMessage && typeof validator.getMessage === 'function') {
            Messages.en[name] = validator.getMessage;
        }

        if (validator.messages) {
            Object.keys(validator.messages).forEach(locale => {
                if (! Messages[locale]) {
                    Messages[locale] = {};
                }

                Messages[locale][name] = validator.messages[locale];
            });
        }
    }

    /**
     * Guards from extnsion violations.
     *
     * @param  {string} name name of the validation rule.
     * @param  {object} validator a validation rule object.
     */
    static guardExtend(name, validator) {
        if (Rules[name]) {
            throw new ValidatorException(
                `Extension Error: There is an existing validator with the same name '${name}'.`
            );
        }

        if (typeof validator === 'function') {
            return;
        }

        if (typeof validator.validate !== 'function') {
            throw new ValidatorException(
                // eslint-disable-next-line
                `Extension Error: The validator '${name}' must be a function or have a 'validate' method.`
            );
        }

        if (typeof validator.getMessage !== 'function' && typeof validator.messages !== 'object') {
            throw new ValidatorException(
                // eslint-disable-next-line
                `Extension Error: The validator '${name}' must have a 'getMessage' method or have a 'messages' object.`
            );
        }
    }

    /**
     * Updates the messages dicitionary, overwriting existing values and adding new ones.
     *
     * @param  {object} messages The messages object.
     */
    updateDictionary(messages) {
        Validator.updateDictionary(messages);
    }

    /**
     * Removes a field from the validator.
     *
     * @param  {string} name The name of the field.
     */
    detach(name) {
        delete this.validations[name];
    }

    /**
     * Adds a custom validator to the list of validation rules.
     *
     * @param  {string} name The name of the validator.
     * @param  {object|function} validator The validator object/function.
     */
    extend(name, validator) {
        Validator.extend(name, validator);
    }

    /**
     * Validates each value against the corresponding field validations.
     * @param  {object} values The values to be validated.
     * @return {boolean|Promise} result Returns a boolean or a promise that will
     * resolve to a boolean.
     */
    validateAll(values) {
        let test = true;
        this.errorBag.clear();
        Object.keys(values).forEach(property => {
            test = this.validate(property, values[property]);
        });

        return test;
    }

    /**
     * Validates a value against a registered field validations.
     *
     * @param  {string} name the field name.
     * @param  {*} value The value to be validated.
     * @return {boolean|Promise} result returns a boolean or a promise that will resolve to
     *  a boolean.
     */
    validate(name, value) {
        let test = true;
        this.errorBag.remove(name);
        this.validations[name].forEach(rule => {
            test = this.test(name, value, rule);
        });

        return test;
    }

    /**
     * Normalizes the validations object.
     *
     * @param  {object} validations
     * @return {object} Normalized object.
     */
    normalize(validations) {
        if (! validations) {
            return {};
        }

        const normalized = {};
        Object.keys(validations).forEach(property => {
            validations[property].split('|').forEach(rule => {
                if (! normalized[property]) {
                    normalized[property] = [];
                }

                normalized[property].push(this.normalizeRule(rule));
            });
        });

        return normalized;
    }

    /**
     * Normalizes a single validation object.
     *
     * @param  {string} rule The rule to be normalized.
     * @return {object} rule The normalized rule.
     */
    normalizeRule(rule) {
        let params = null;
        if (~rule.indexOf(':')) {
            params = rule.split(':')[1].split(',');
        }

        return {
            name: rule.split(':')[0],
            params
        };
    }

    /**
     * Formats an error message for field and a rule.
     *
     * @param  {string} field The field name.
     * @param  {object} rule Normalized rule object.
     * @return {string} msg Formatted error message.
     */
    formatErrorMessage(field, rule) {
        if (! Messages[this.locale] || typeof Messages[this.locale][rule.name] !== 'function') {
            // Default to english message.
            return Messages.en[rule.name](field, rule.params);
        }

        return Messages[this.locale][rule.name](field, rule.params);
    }

    /**
     * Tests a single input value against a rule.
     *
     * @param  {*} name The name of the field.
     * @param  {*} value  [description]
     * @param  {object} rule the rule object.
     * @return {boolean} Wether if it passes the check.
     */
    test(name, value, rule) {
        const validator = Rules[rule.name];
        const valid = validator(value, rule.params);

        if (valid instanceof Promise) {
            return valid.then(values => {
                const allValid = values.reduce((prev, curr) => prev && curr.valid, true);

                if (! allValid) {
                    this.errorBag.add(name, this.formatErrorMessage(name, rule));
                }

                return allValid;
            });
        }

        if (! valid) {
            this.errorBag.add(name, this.formatErrorMessage(name, rule));
        }

        return valid;
    }

    /**
     * Gets the internal errorBag instance.
     *
     * @return {ErrorBag} errorBag The internal error bag object.
     */
    getErrors() {
        return this.errorBag;
    }
}
