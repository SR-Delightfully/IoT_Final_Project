import { useState } from "react";

function Registration() {
  // const handleSubmit = async (e) => {
  //   e.preventDefault();

  //   const formData = new FormData(e.target);
  //   const userData = {
  //     fname: formData.get("fname"),
  //     lname: formData.get("lname"),
  //   };

  //   const userData = ["fname", "lname"];
  // }

  return (
    <main className="home-page">
      <div className="home-card">
        <div className="home-card-body">
          <h1 className="home-title">
            Our Community
          </h1>

          <p className="home-subtitle">
           <i> share us with your friends to get 10% off your first purchase!</i>
          </p>

          <div className="customer-list">
            <div className="customer-card">
              <div id="customer-pfp" /> {/* to be changed for an img tag later */}
              <h3 className="customer-name">John Doe</h3>
              <span className="customer-doc">
                <h4 className="doc-title">Date Joined:</h4>
                <p className="date">2026-09-23</p> 
              </span>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

// const createCustomer = async () => {
//   try {
//     const res = await fetch('https://localhost:5173/', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         title: 'user',
//         body: '',
//         userId: 1
//       }),
//     });
//     const customerData = await res.json();
//     console.log('POST response:', customerData);
//   } catch (error) {
//     console.error('Error creating customer:', error);
//   }
// };

export default Registration;