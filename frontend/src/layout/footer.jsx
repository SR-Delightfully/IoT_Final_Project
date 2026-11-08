
const Footer = ({ eyebrow, title, subtitle, misc }) => {
    // Now these will print exactly what you expect
    console.log("eyebrow: " + eyebrow);
    console.log("title: " + title);
    console.log("subtitle: " + subtitle);
    console.log("misc: " + misc);

    return (
        <footer className="footer">
            <div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>
            <div className="misc">
                <span className="eyebrow">{eyebrow}</span>
                
                {misc}
            </div>
        </footer>
    );
}
    
export default Footer;