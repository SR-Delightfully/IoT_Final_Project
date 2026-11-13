
import { useState } from "react";

const sampleProducts = [
    { id: 1, name: "Charizard ex", category: "Singles", price: "$24.99", stock: 4, symbol: "♢" },
    { id: 2, name: "151 Elite Trainer Box", category: "Sealed", price: "$89.99", stock: 18, symbol: "▣" },
    { id: 3, name: "One Piece Booster Pack", category: "Sealed", price: "$6.99", stock: 42, symbol: "▤" }
];

const navigation = [
    ["buttons", "Buttons"],
    ["cards", "Cards"],
    ["forms", "Forms"],
    ["feedback", "Feedback"],
    ["navigation", "Navigation"],
    ["carousels", "Carousels"],
    ["data", "Data display"],
    ["misc", "Other elements"]
];

function Section({ id, number, title, description, children }) {
    return (
        <section className="specimen-section" id={id}>
            <div className="section-heading">
                <div>
                    <span className="eyebrow">COMPONENT / {number}</span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>
                <span className="section-index">{number}</span>
            </div>
            {children}
        </section>
    );
}

function Specimen({ title, description, children, className = "" }) {
    return (
        <article className={`specimen ${className}`}>
            <div className="specimen-heading">
                <div>
                    <h3>{title}</h3>
                    {description && <p>{description}</p>}
                </div>
            </div>
            <div className="specimen-content">{children}</div>
        </article>
    );
}

function Label({ children }) {
    return <span className="component-label">{children}</span>;
}

function Button({ children, variant = "primary", size = "md", ...props }) {
    return (
        <button
            className={`ui-button ui-button-${variant} ui-button-${size}`}
            {...props}
        >
            {children}
        </button>
    );
}

function Badge({ children, variant = "neutral", outline = false }) {
    return (
        <span className={`ui-badge badge-${variant} ${outline ? "badge-outline" : ""}`}>
            <span className="badge-dot" />
            {children}
        </span>
    );
}

function SampleCard({ variant = "standard", title, children }) {
    return (
        <article className={`sample-card card-${variant}`}>
            <div className="sample-card-top">
                <span className="card-symbol">✧</span>
                <Badge variant={variant === "featured" ? "gold" : "neutral"}>
                    {variant === "featured" ? "Featured" : "Preview"}
                </Badge>
            </div>
            <h4>{title}</h4>
            <p>{children}</p>
            <div className="sample-card-footer">
                <span>COMPONENT PREVIEW</span>
                <button aria-label={`View ${title}`}>↗</button>
            </div>
        </article>
    );
}

function ButtonsSection() {
    const [loading, setLoading] = useState(false);
    const [pressed, setPressed] = useState(false);

    return (
        <Section
            id="buttons"
            number="01"
            title="Buttons"
            description="Button styles, sizes, shapes, states and icon combinations."
        >
            <div className="specimen-grid">
                <Specimen title="Button variants" description="Primary, secondary, tertiary and destructive actions." className="span-2">
                    <div className="component-row">
                        <Button>Primary</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="gold">Gold</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="danger">Danger</Button>
                    </div>
                </Specimen>

                <Specimen title="Button sizes" description="Small, medium, large and full-width options.">
                    <div className="component-row align-center">
                        <Button size="sm">Small</Button>
                        <Button size="md">Medium</Button>
                        <Button size="lg">Large</Button>
                    </div>
                    <Button size="full" variant="secondary">Full width button</Button>
                </Specimen>

                <Specimen title="Button shapes" description="Different corner treatments.">
                    <div className="component-row align-center">
                        <Button variant="primary">Square</Button>
                        <Button variant="rounded">Rounded</Button>
                        <Button variant="pill">Pill</Button>
                        <Button variant="icon" aria-label="Settings">⚙</Button>
                        <Button variant="icon-rounded" aria-label="Add">+</Button>
                    </div>
                </Specimen>

                <Specimen title="Icon combinations">
                    <div className="component-row">
                        <Button>＋ Add item</Button>
                        <Button variant="secondary">← Back</Button>
                        <Button variant="gold">Continue →</Button>
                        <Button variant="outline">⌕ Search</Button>
                    </div>
                </Specimen>

                <Specimen title="Button states">
                    <div className="component-row">
                        <Button>Default</Button>
                        <Button className="state-hover">Hover preview</Button>
                        <Button variant="secondary" disabled>Disabled</Button>
                        <Button variant="gold" onClick={() => setPressed(!pressed)}>
                            {pressed ? "✓ Selected" : "Selectable"}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={loading}
                            onClick={() => {
                                setLoading(true);
                                setTimeout(() => setLoading(false), 1200);
                            }}
                        >
                            {loading ? "◌ Loading..." : "Try loading"}
                        </Button>
                    </div>
                </Specimen>

                <Specimen title="Button groups">
                    <div className="button-group">
                        <button>Day</button>
                        <button className="active">Week</button>
                        <button>Month</button>
                        <button>Year</button>
                    </div>
                    <div className="component-row">
                        <Button variant="primary">Save changes</Button>
                        <Button variant="ghost">Cancel</Button>
                    </div>
                </Specimen>
            </div>
        </Section>
    );
}

function CardsSection() {
    return (
        <Section
            id="cards"
            number="02"
            title="Cards"
            description="Different card surfaces, content arrangements, emphasis and density."
        >
            <div className="specimen-grid">
                <Specimen title="Basic card" description="Simple content container.">
                    <SampleCard title="Standard card">A simple card with a heading, description and footer action.</SampleCard>
                </Specimen>

                <Specimen title="Featured card" description="Elevated visual emphasis.">
                    <SampleCard variant="featured" title="Featured card">An emphasized surface with gold accents and additional contrast.</SampleCard>
                </Specimen>

                <Specimen title="Outlined card" description="Minimal surface with a visible border.">
                    <SampleCard variant="outlined" title="Outlined card">A lightweight variation for secondary information.</SampleCard>
                </Specimen>

                <Specimen title="Compact card" description="Reduced padding and condensed content.">
                    <SampleCard variant="compact" title="Compact card">A smaller card for dense layouts and repeated information.</SampleCard>
                </Specimen>

                <Specimen title="Interactive cards" description="Selectable and hoverable card surfaces." className="span-2">
                    <div className="card-grid">
                        {["Option A", "Option B", "Option C"].map((item, index) => (
                            <button className={`option-card ${index === 1 ? "selected" : ""}`} key={item}>
                                <span>{["♢", "✧", "◇"][index]}</span>
                                <strong>{item}</strong>
                                <small>{index === 1 ? "Selected" : "Choose option"}</small>
                            </button>
                        ))}
                    </div>
                </Specimen>

                <Specimen title="Horizontal card" description="Side-by-side content arrangement." className="span-2">
                    <div className="horizontal-card">
                        <div className="horizontal-card-icon">▣</div>
                        <div>
                            <Label>PRODUCT / 001</Label>
                            <h4>Product information</h4>
                            <p>Horizontal layouts are useful for search results, lists and compact previews.</p>
                        </div>
                        <Button variant="outline" size="sm">View</Button>
                    </div>
                </Specimen>

                <Specimen title="Stat cards" description="Metrics and numerical summaries." className="span-2">
                    <div className="stat-grid">
                        {[
                            ["Total products", "248", "+12%"],
                            ["Revenue", "$8.4k", "+8.2%"],
                            ["Low stock", "04", "Needs review"],
                            ["Customers", "1,284", "+24"]
                        ].map(([label, value, detail], index) => (
                            <div className="mini-stat" key={label}>
                                <span>{label}</span>
                                <strong>{value}</strong>
                                <small className={index === 2 ? "text-warning" : "text-success"}>{detail}</small>
                            </div>
                        ))}
                    </div>
                </Specimen>
            </div>
        </Section>
    );
}

function FormsSection() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        category: "Singles",
        quantity: 1,
        description: "",
        enabled: true,
        newsletter: false,
        option: "standard",
        range: 65
    });

    const update = (key, value) => {
        setForm(current => ({ ...current, [key]: value }));
    };

    const [submitted, setSubmitted] = useState(false);

    return (
        <Section
            id="forms"
            number="03"
            title="Forms and inputs"
            description="Input fields, selection controls, validation states and form layouts."
        >
            <div className="specimen-grid">
                <Specimen title="Text inputs" description="Standard, focused, filled and disabled fields." className="span-2">
                    <div className="input-grid">
                        <label className="field">
                            <span>Default input</span>
                            <input placeholder="Enter a value..." />
                        </label>
                        <label className="field">
                            <span>Filled input</span>
                            <input defaultValue="Charizard ex" />
                        </label>
                        <label className="field">
                            <span>Search input</span>
                            <div className="input-icon">
                                <span>⌕</span>
                                <input placeholder="Search..." />
                            </div>
                        </label>
                        <label className="field">
                            <span>Disabled input</span>
                            <input value="Unavailable" disabled readOnly />
                        </label>
                        <label className="field">
                            <span>Email input</span>
                            <input type="email" placeholder="name@example.com" />
                        </label>
                        <label className="field">
                            <span>Password input</span>
                            <input type="password" placeholder="Enter password" />
                        </label>
                        <label className="field">
                            <span>Error state</span>
                            <input className="input-error" defaultValue="Invalid value" />
                            <small className="field-error">Please enter a valid value.</small>
                        </label>
                        <label className="field">
                            <span>Success state</span>
                            <input className="input-success" defaultValue="Valid entry" />
                            <small className="field-success">Looks good!</small>
                        </label>
                    </div>
                </Specimen>

                <Specimen title="Select menus" description="Native dropdowns and selection styles.">
                    <label className="field">
                        <span>Standard select</span>
                        <select defaultValue="Singles">
                            <option>Singles</option>
                            <option>Sealed</option>
                            <option>Accessories</option>
                        </select>
                    </label>
                    <label className="field">
                        <span>Disabled select</span>
                        <select disabled><option>Unavailable</option></select>
                    </label>
                    <label className="field">
                        <span>Number input</span>
                        <input type="number" defaultValue="10" min="0" />
                    </label>
                </Specimen>

                <Specimen title="Textareas" description="Multi-line text entry.">
                    <label className="field">
                        <span>Standard textarea</span>
                        <textarea placeholder="Write something..." rows="3" />
                    </label>
                    <label className="field">
                        <span>Filled textarea</span>
                        <textarea defaultValue="Sample description for a product or message." rows="3" />
                    </label>
                </Specimen>

                <Specimen title="Checkboxes and radios">
                    <div className="control-list">
                        <label className="check-control">
                            <input type="checkbox" defaultChecked />
                            <span className="check-box" />
                            <span>Checked checkbox</span>
                        </label>
                        <label className="check-control">
                            <input type="checkbox" />
                            <span className="check-box" />
                            <span>Unchecked checkbox</span>
                        </label>
                        <label className="check-control">
                            <input type="checkbox" disabled />
                            <span className="check-box" />
                            <span>Disabled checkbox</span>
                        </label>
                        <label className="check-control">
                            <input type="radio" name="radio-demo" defaultChecked />
                            <span className="radio-box" />
                            <span>Selected radio</span>
                        </label>
                        <label className="check-control">
                            <input type="radio" name="radio-demo" />
                            <span className="radio-box" />
                            <span>Unselected radio</span>
                        </label>
                    </div>
                </Specimen>

                <Specimen title="Switches and sliders">
                    <div className="control-list">
                        <label className="switch-control">
                            <span>Enabled setting</span>
                            <input type="checkbox" defaultChecked />
                            <span className="switch-track" />
                        </label>
                        <label className="switch-control">
                            <span>Disabled setting</span>
                            <input type="checkbox" />
                            <span className="switch-track" />
                        </label>
                    </div>
                    <label className="field range-field">
                        <span>Range slider</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={form.range}
                            onChange={event => update("range", Number(event.target.value))}
                        />
                        <small>{form.range}%</small>
                    </label>
                </Specimen>

                <Specimen title="Quantity controls">
                    <div className="quantity-variations">
                        <div className="quantity-control">
                            <button onClick={() => update("quantity", Math.max(1, form.quantity - 1))}>−</button>
                            <span>{form.quantity}</span>
                            <button onClick={() => update("quantity", form.quantity + 1)}>+</button>
                        </div>
                        <div className="quantity-control quantity-large">
                            <button onClick={() => update("quantity", Math.max(1, form.quantity - 1))}>−</button>
                            <span>{form.quantity}</span>
                            <button onClick={() => update("quantity", form.quantity + 1)}>+</button>
                        </div>
                    </div>
                </Specimen>

                <Specimen title="Complete form" description="A compact example combining multiple controls." className="span-2">
                    <form
                        className="demo-form"
                        onSubmit={event => {
                            event.preventDefault();
                            setSubmitted(true);
                        }}
                    >
                        <div className="input-grid">
                            <label className="field">
                                <span>Product name</span>
                                <input
                                    value={form.name}
                                    onChange={event => update("name", event.target.value)}
                                    placeholder="Product name"
                                    required
                                />
                            </label>
                            <label className="field">
                                <span>Email address</span>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={event => update("email", event.target.value)}
                                    placeholder="name@example.com"
                                    required
                                />
                            </label>
                            <label className="field">
                                <span>Category</span>
                                <select value={form.category} onChange={event => update("category", event.target.value)}>
                                    <option>Singles</option>
                                    <option>Sealed</option>
                                    <option>Accessories</option>
                                </select>
                            </label>
                            <label className="field">
                                <span>Quantity</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={form.quantity}
                                    onChange={event => update("quantity", Number(event.target.value))}
                                />
                            </label>
                        </div>
                        <label className="field">
                            <span>Description</span>
                            <textarea
                                rows="2"
                                value={form.description}
                                onChange={event => update("description", event.target.value)}
                                placeholder="Additional information..."
                            />
                        </label>
                        <label className="check-control">
                            <input
                                type="checkbox"
                                checked={form.newsletter}
                                onChange={event => update("newsletter", event.target.checked)}
                            />
                            <span className="check-box" />
                            <span>Subscribe to updates</span>
                        </label>
                        <div className="component-row align-center">
                            <Button type="submit">Submit form →</Button>
                            <Button type="reset" variant="ghost" onClick={() => setSubmitted(false)}>Reset</Button>
                            {submitted && <Badge variant="success">Form submitted</Badge>}
                        </div>
                    </form>
                </Specimen>
            </div>
        </Section>
    );
}

function FeedbackSection() {
    const [dismissed, setDismissed] = useState(false);
    const [toast, setToast] = useState(false);

    return (
        <Section
            id="feedback"
            number="04"
            title="Feedback and status"
            description="Badges, alerts, notifications, tooltips and feedback messages."
        >
            <div className="specimen-grid">
                <Specimen title="Badges" description="Status and category indicators." className="span-2">
                    <div className="component-row">
                        <Badge variant="success">Active</Badge>
                        <Badge variant="warning">Pending</Badge>
                        <Badge variant="danger">Unavailable</Badge>
                        <Badge variant="info">Information</Badge>
                        <Badge variant="gold">Featured</Badge>
                        <Badge variant="neutral">Default</Badge>
                    </div>
                    <div className="component-row">
                        <Badge variant="success" outline>Success</Badge>
                        <Badge variant="warning" outline>Warning</Badge>
                        <Badge variant="danger" outline>Error</Badge>
                        <Badge variant="gold" outline>Premium</Badge>
                    </div>
                </Specimen>

                <Specimen title="Status indicators">
                    <div className="status-list">
                        <div><span className="status-light online" /> Online <small>Connected</small></div>
                        <div><span className="status-light busy" /> Busy <small>In progress</small></div>
                        <div><span className="status-light offline" /> Offline <small>Disconnected</small></div>
                        <div><span className="status-light idle" /> Idle <small>Waiting</small></div>
                    </div>
                </Specimen>

                <Specimen title="Alert messages" className="span-2">
                    <div className="alert alert-success"><span>✓</span><div><strong>Success</strong><p>Your changes have been saved successfully.</p></div></div>
                    <div className="alert alert-warning"><span>!</span><div><strong>Warning</strong><p>Please review the information before continuing.</p></div></div>
                    <div className="alert alert-danger"><span>×</span><div><strong>Error</strong><p>Something went wrong. Please try again.</p></div></div>
                    <div className="alert alert-info"><span>i</span><div><strong>Information</strong><p>This is an informational message for the user.</p></div></div>
                </Specimen>

                <Specimen title="Dismissible notification">
                    {!dismissed ? (
                        <div className="notification">
                            <span>✧</span>
                            <div><strong>New notification</strong><p>Your account information has been updated.</p><small>Just now</small></div>
                            <button onClick={() => setDismissed(true)} aria-label="Dismiss notification">×</button>
                        </div>
                    ) : (
                        <div className="empty-mini">Notification dismissed.</div>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setDismissed(false)}>Reset example</Button>
                </Specimen>

                <Specimen title="Tooltips and helper text">
                    <div className="component-row">
                        <span className="tooltip-demo">Hover me <span>Additional information</span></span>
                        <span className="helper-text">ⓘ Helpful contextual text</span>
                    </div>
                    <label className="field">
                        <span>Password <small className="helper-text">Must be at least 8 characters.</small></span>
                        <input type="password" placeholder="Enter password" />
                    </label>
                </Specimen>

                <Specimen title="Toast feedback">
                    <div className="component-row">
                        <Button size="sm" onClick={() => setToast(true)}>Show toast</Button>
                        <Button size="sm" variant="outline" onClick={() => setToast(false)}>Dismiss</Button>
                    </div>
                    {toast && <div className="toast-preview"><span>✓</span> Action completed successfully.</div>}
                </Specimen>

                <Specimen title="Empty states">
                    <div className="empty-component">
                        <span>◇</span>
                        <strong>Nothing here yet</strong>
                        <p>Content will appear here when available.</p>
                        <Button size="sm" variant="outline">Get started</Button>
                    </div>
                </Specimen>
            </div>
        </Section>
    );
}

function NavigationSection() {
    const [tab, setTab] = useState("overview");
    const [page, setPage] = useState(1);

    return (
        <Section
            id="navigation"
            number="05"
            title="Navigation"
            description="Navigation bars, tabs, breadcrumbs, segmented controls and pagination."
        >
            <div className="specimen-grid">
                <Specimen title="Horizontal navigation" className="span-2">
                    <nav className="demo-navbar">
                        <strong>BRAND<span>.</span></strong>
                        <div><a className="active">Home</a><a>Products</a><a>About</a><a>Contact</a></div>
                        <Button size="sm">Sign in</Button>
                    </nav>
                </Specimen>

                <Specimen title="Vertical navigation">
                    <nav className="vertical-nav">
                        {["⌂ Overview", "▦ Products", "♢ Customers", "⚙ Settings"].map((item, index) => (
                            <button className={index === 0 ? "active" : ""} key={item}>{item}</button>
                        ))}
                    </nav>
                </Specimen>

                <Specimen title="Breadcrumbs">
                    <div className="breadcrumbs">
                        <a>Home</a><span>/</span><a>Products</a><span>/</span><strong>Details</strong>
                    </div>
                </Specimen>

                <Specimen title="Tabs" className="span-2">
                    <div className="tabs">
                        {["overview", "details", "activity", "settings"].map(item => (
                            <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>
                        ))}
                    </div>
                    <div className="tab-content"><strong>{tab.charAt(0).toUpperCase() + tab.slice(1)}</strong><p>Content preview for the selected tab.</p></div>
                </Specimen>

                <Specimen title="Segmented controls">
                    <div className="segmented-control">
                        <button>Daily</button>
                        <button className="active">Weekly</button>
                        <button>Monthly</button>
                    </div>
                </Specimen>

                <Specimen title="Pagination" className="span-2">
                    <div className="pagination">
                        <button disabled>←</button>
                        {[1, 2, 3, 4, 5].map(number => (
                            <button className={page === number ? "active" : ""} key={number} onClick={() => setPage(number)}>{number}</button>
                        ))}
                        <span>...</span>
                        <button onClick={() => setPage(Math.min(5, page + 1))}>→</button>
                    </div>
                </Specimen>
            </div>
        </Section>
    );
}

function CarouselsSection() {
    const [active, setActive] = useState(0);
    const slides = [
        { title: "First slide", subtitle: "Standard carousel item", symbol: "✧" },
        { title: "Second slide", subtitle: "Alternative content variation", symbol: "◇" },
        { title: "Third slide", subtitle: "Another example layout", symbol: "♢" }
    ];

    const changeSlide = direction => {
        setActive(current => (current + direction + slides.length) % slides.length);
    };

    return (
        <Section
            id="carousels"
            number="06"
            title="Carousels and sliders"
            description="Horizontal scrolling, featured slides, indicators and compact item navigation."
        >
            <div className="specimen-grid">
                <Specimen title="Featured carousel" description="Large slide with navigation controls." className="span-2">
                    <div className="demo-carousel">
                        <button className="carousel-arrow" onClick={() => changeSlide(-1)} aria-label="Previous slide">←</button>
                        <div className="carousel-slide">
                            <span>{slides[active].symbol}</span>
                            <Label>SLIDE / 0{active + 1}</Label>
                            <h3>{slides[active].title}</h3>
                            <p>{slides[active].subtitle}</p>
                        </div>
                        <button className="carousel-arrow" onClick={() => changeSlide(1)} aria-label="Next slide">→</button>
                        <div className="carousel-indicators">
                            {slides.map((slide, index) => (
                                <button key={slide.title} className={active === index ? "active" : ""} onClick={() => setActive(index)} aria-label={`Go to slide ${index + 1}`} />
                            ))}
                        </div>
                    </div>
                </Specimen>

                <Specimen title="Card carousel" description="Horizontal collection of cards." className="span-2">
                    <div className="mini-carousel">
                        {sampleProducts.map(product => (
                            <article className="carousel-card" key={product.id}>
                                <span>{product.symbol}</span>
                                <strong>{product.name}</strong>
                                <small>{product.category}</small>
                                <b>{product.price}</b>
                            </article>
                        ))}
                    </div>
                </Specimen>

                <Specimen title="Carousel indicators">
                    <div className="component-row align-center">
                        <div className="carousel-indicators static">
                            {[0, 1, 2, 3].map(number => <button key={number} className={number === 1 ? "active" : ""} />)}
                        </div>
                        <span className="helper-text">02 / 04</span>
                    </div>
                </Specimen>

                <Specimen title="Slider navigation">
                    <div className="slider-preview">
                        <button>←</button>
                        <span>01 / 06</span>
                        <button>→</button>
                    </div>
                    <div className="progress-track"><span style={{ width: "35%" }} /></div>
                </Specimen>
            </div>
        </Section>
    );
}

function DataSection() {
    const [sort, setSort] = useState("name");

    return (
        <Section
            id="data"
            number="07"
            title="Data display"
            description="Tables, lists, progress indicators, avatars and data summaries."
        >
            <div className="specimen-grid">
                <Specimen title="Data table" description="Standard table with row states and status indicators." className="span-2">
                    <div className="table-container">
                        <table className="demo-table">
                            <thead>
                                <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {sampleProducts.map(product => (
                                    <tr key={product.id}>
                                        <td><span className="table-name"><i>{product.symbol}</i>{product.name}</span></td>
                                        <td>{product.category}</td>
                                        <td>{product.price}</td>
                                        <td>{product.stock}</td>
                                        <td><Badge variant={product.stock <= 5 ? "warning" : "success"}>{product.stock <= 5 ? "Low stock" : "Available"}</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Specimen>

                <Specimen title="Progress bars">
                    <div className="progress-list">
                        {[["Storage", 75], ["Inventory", 42], ["Capacity", 90], ["Completion", 25]].map(([name, value]) => (
                            <div className="progress-item" key={name}>
                                <div><span>{name}</span><strong>{value}%</strong></div>
                                <div className="progress-track"><span style={{ width: `${value}%` }} /></div>
                            </div>
                        ))}
                    </div>
                </Specimen>

                <Specimen title="Circular indicators">
                    <div className="circle-progress-list">
                        {[65, 80, 45].map(value => (
                            <div className="circle-progress" key={value} style={{ "--progress": `${value * 3.6}deg` }}>
                                <div><strong>{value}%</strong></div>
                            </div>
                        ))}
                    </div>
                </Specimen>

                <Specimen title="Avatars">
                    <div className="component-row align-center">
                        <span className="avatar avatar-sm">SR</span>
                        <span className="avatar">AB</span>
                        <span className="avatar avatar-lg">TC</span>
                        <span className="avatar avatar-square">JD</span>
                        <div className="avatar-stack">
                            <span className="avatar">A</span><span className="avatar">B</span><span className="avatar">C</span><span className="avatar">+4</span>
                        </div>
                    </div>
                </Specimen>

                <Specimen title="Lists">
                    <div className="demo-list">
                        {["First list item", "Second list item", "Third list item"].map((item, index) => (
                            <div key={item}><span>0{index + 1}</span><strong>{item}</strong><small>↗</small></div>
                        ))}
                    </div>
                </Specimen>

                <Specimen title="Dividers and separators">
                    <div className="divider-samples">
                        <span>Standard divider</span><hr />
                        <span>Subtle divider</span><hr className="subtle-divider" />
                        <span>Decorative divider</span><div className="decorative-divider">✧</div>
                    </div>
                </Specimen>
            </div>
        </Section>
    );
}

function MiscSection() {
    const [expanded, setExpanded] = useState(0);
    const [modal, setModal] = useState(false);

    return (
        <Section
            id="misc"
            number="08"
            title="Other elements"
            description="Accordions, overlays, separators and miscellaneous reusable patterns."
        >
            <div className="specimen-grid">
                <Specimen title="Accordion" className="span-2">
                    {["General information", "Account settings", "Additional details"].map((item, index) => (
                        <div className="accordion-item" key={item}>
                            <button onClick={() => setExpanded(expanded === index ? -1 : index)}>
                                <strong>{item}</strong><span>{expanded === index ? "−" : "+"}</span>
                            </button>
                            {expanded === index && <p>Example accordion content. This area expands and collapses when the heading is selected.</p>}
                        </div>
                    ))}
                </Specimen>

                <Specimen title="Modal preview">
                    <p className="helper-text">Preview a basic confirmation dialog.</p>
                    <Button onClick={() => setModal(true)}>Open modal</Button>
                    {modal && (
                        <div className="modal-overlay" onMouseDown={event => {
                            if (event.target === event.currentTarget) setModal(false);
                        }}>
                            <div className="modal-box">
                                <div className="modal-heading"><Label>DIALOG / 001</Label><button onClick={() => setModal(false)}>×</button></div>
                                <h3>Confirm action</h3>
                                <p>This is an example modal window with a title, description and actions.</p>
                                <div className="component-row">
                                    <Button size="sm" onClick={() => setModal(false)}>Confirm</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Specimen>

                <Specimen title="Loading states">
                    <div className="loading-samples">
                        <span className="spinner" />
                        <span className="skeleton skeleton-title" />
                        <span className="skeleton skeleton-line" />
                        <span className="skeleton skeleton-line short" />
                    </div>
                </Specimen>

                <Specimen title="Tags and chips">
                    <div className="component-row">
                        <span className="chip">Default <button>×</button></span>
                        <span className="chip chip-gold">Featured <button>×</button></span>
                        <span className="chip chip-purple">Premium <button>×</button></span>
                        <span className="chip">Category</span>
                    </div>
                </Specimen>

                <Specimen title="Dropdown menu">
                    <details className="dropdown-demo">
                        <summary>More options <span>⌄</span></summary>
                        <div>
                            <button>View details</button>
                            <button>Edit item</button>
                            <button>Duplicate</button>
                            <button className="text-danger">Delete</button>
                        </div>
                    </details>
                </Specimen>

                <Specimen title="Code and keyboard elements">
                    <div className="code-preview">GET /api/products</div>
                    <div className="component-row align-center">
                        <kbd>Ctrl</kbd><span>+</span><kbd>K</kbd>
                        <span className="helper-text">Keyboard shortcut</span>
                    </div>
                </Specimen>
            </div>
        </Section>
    );
}

export default function Testing() {
    return (
        <main className="showcase">
            <header className="showcase-header">
                <a className="showcase-brand" href="#top">
                    <span className="brand-mark">S</span>
                    <span><strong>SMART TCG</strong><small>DESIGN SYSTEM</small></span>
                </a>
                <div className="header-meta">
                    <span>THEME PLANNER</span>
                    <Badge variant="success">Preview mode</Badge>
                </div>
            </header>

            <div className="showcase-intro" id="top">
                <div>
                    <span className="eyebrow">INTERFACE LIBRARY / 2026</span>
                    <h1>Component <span>gallery.</span></h1>
                    <p>A visual reference for exploring interface components, styles, states and layout variations before applying them throughout the application.</p>
                </div>
                <div className="intro-meta">
                    <strong>08</strong>
                    <span>COMPONENT GROUPS</span>
                    <span>DESIGN SYSTEM / 01</span>
                </div>
            </div>

            <nav className="showcase-nav">
                {navigation.map(([id, label], index) => (
                    <a href={`#${id}`} key={id}>
                        <span>0{index + 1}</span>{label}
                    </a>
                ))}
            </nav>

            <div className="gallery-content">
                <div className="gallery-toolbar">
                    <div><span className="eyebrow">LIBRARY / ALL COMPONENTS</span><strong>UI ELEMENTS</strong></div>
                    <span>LIVE INTERACTIVE PREVIEW <i /></span>
                </div>

                <ButtonsSection />
                <CardsSection />
                <FormsSection />
                <FeedbackSection />
                <NavigationSection />
                <CarouselsSection />
                <DataSection />
                <MiscSection />
            </div>

            <footer className="showcase-footer">
                <span>SMART TCG STORE / DESIGN SYSTEM</span>
                <span>COMPONENT LIBRARY · 2026</span>
            </footer>
        </main>
    );
}
